package io.github.apispector.scanner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

public class OpenApiSpecBuilder {

    private final ObjectMapper mapper;
    private final SchemaResolver schemaResolver;
    private final ApiSpectorScanProperties properties;

    public OpenApiSpecBuilder(
        ObjectMapper mapper,
        ApiSpectorScanProperties properties
    ) {
        this.mapper = mapper;
        this.properties = properties;
        this.schemaResolver = new SchemaResolver(mapper);
    }

    public ObjectNode build(RequestMappingHandlerMapping handlerMapping) {
        ObjectNode root = mapper.createObjectNode();
        root.put("openapi", "3.1.0");

        ObjectNode info = root.putObject("info");
        info.put("title", properties.getTitle());
        info.put("version", properties.getVersion());
        if (properties.getDescription() != null && !properties.getDescription().isBlank()) {
            info.put("description", properties.getDescription());
        }

        ArrayNode servers = root.putArray("servers");
        List<String> serverUrls = properties.getServers();
        if (serverUrls.isEmpty()) {
            ObjectNode server = servers.addObject();
            server.put("url", "/");
        } else {
            for (String url : serverUrls) {
                ObjectNode server = servers.addObject();
                server.put("url", url);
            }
        }

        ObjectNode paths = root.putObject("paths");
        final java.util.concurrent.atomic.AtomicBoolean anySecured =
            new java.util.concurrent.atomic.AtomicBoolean(false);

        Map<RequestMappingInfo, HandlerMethod> handlers = new LinkedHashMap<>(
            handlerMapping.getHandlerMethods()
        );
        handlers.entrySet().stream()
            .sorted(Comparator.comparing(e -> firstPattern(e.getKey())))
            .forEach(entry -> {
                RequestMappingInfo mappingInfo = entry.getKey();
                HandlerMethod handler = entry.getValue();
                if (!matchesPackage(handler.getBeanType())) {
                    return;
                }
                for (String pattern : patterns(mappingInfo)) {
                    if (isExcluded(pattern)) {
                        continue;
                    }
                    ObjectNode pathItem = paths.has(pattern)
                        ? (ObjectNode) paths.get(pattern)
                        : paths.putObject(pattern);
                    for (RequestMethod method : httpMethods(mappingInfo)) {
                        ObjectNode operation = buildOperation(handler, method, pattern);
                        pathItem.set(method.name().toLowerCase(), operation);
                        if (operation.has("security")) {
                            anySecured.set(true);
                        }
                    }
                }
            });

        ObjectNode components = root.putObject("components");
        ObjectNode schemas = schemaResolver.componentsSchemas();
        if (!schemas.isEmpty()) {
            components.set("schemas", schemas);
        }
        if (anySecured.get()) {
            ObjectNode securitySchemes = components.putObject("securitySchemes");
            ObjectNode bearer = securitySchemes.putObject("bearerAuth");
            bearer.put("type", "http");
            bearer.put("scheme", "bearer");
        }

        return root;
    }

    private ObjectNode buildOperation(
        HandlerMethod handler,
        RequestMethod httpMethod,
        String pathPattern
    ) {
        Method method = handler.getMethod();
        Class<?> beanType = handler.getBeanType();
        List<String> pathVariableNames = pathVariableNamesFromPattern(pathPattern);
        int pathVarIndex = 0;

        ObjectNode operation = mapper.createObjectNode();
        operation.put("operationId", operationId(beanType, method));
        operation.put("summary", humanize(method.getName()));

        ArrayNode tags = operation.putArray("tags");
        tags.add(controllerTag(beanType));

        if (method.getAnnotation(Deprecated.class) != null
            || beanType.getAnnotation(Deprecated.class) != null) {
            operation.put("deprecated", true);
        }

        if (SpringSecurityIntrospector.requiresAuth(method, beanType)) {
            ArrayNode security = operation.putArray("security");
            ObjectNode req = security.addObject();
            req.putArray("bearerAuth");
        }

        ArrayNode parameters = operation.putArray("parameters");
        Type requestBodyType = null;
        String requestBodyContentType = MediaType.APPLICATION_JSON_VALUE;

        for (Parameter parameter : method.getParameters()) {
            if (parameter.isAnnotationPresent(PathVariable.class)) {
                parameters.add(pathParameter(parameter, pathVariableNames, pathVarIndex++));
            } else if (parameter.isAnnotationPresent(RequestParam.class)) {
                parameters.add(queryParameter(parameter));
            } else if (parameter.isAnnotationPresent(RequestHeader.class)) {
                parameters.add(headerParameter(parameter));
            } else if (parameter.isAnnotationPresent(CookieValue.class)) {
                parameters.add(cookieParameter(parameter));
            } else if (parameter.isAnnotationPresent(RequestBody.class)) {
                requestBodyType = parameter.getParameterizedType();
            }
        }

        if (parameters.isEmpty()) {
            operation.remove("parameters");
        }

        if (requestBodyType != null && httpMethod != RequestMethod.GET && httpMethod != RequestMethod.DELETE) {
            ObjectNode requestBody = operation.putObject("requestBody");
            requestBody.put("required", true);
            ObjectNode content = requestBody.putObject("content");
            ObjectNode media = content.putObject(requestBodyContentType);
            ObjectNode schema = schemaResolver.resolve(requestBodyType);
            if (schema != null) {
                media.set("schema", schema);
            }
        }

        int status = defaultStatus(method, httpMethod);
        ObjectNode responses = operation.putObject("responses");
        ObjectNode response = responses.putObject(String.valueOf(status));
        response.put("description", "Successful response");

        Type returnType = method.getGenericReturnType();
        if (returnType != Void.TYPE && returnType != Void.class) {
            ObjectNode content = response.putObject("content");
            ObjectNode media = content.putObject(MediaType.APPLICATION_JSON_VALUE);
            ObjectNode schema = schemaResolver.resolve(returnType);
            if (schema != null) {
                media.set("schema", schema);
            }
        }

        return operation;
    }

    private ObjectNode pathParameter(
        Parameter parameter,
        List<String> pathVariableNames,
        int pathVarIndex
    ) {
        PathVariable ann = parameter.getAnnotation(PathVariable.class);
        String name = resolveParameterName(
            ann.name(),
            ann.value(),
            parameter.getName(),
            pathVariableNames,
            pathVarIndex
        );
        return buildParameter("path", name, parameter, true);
    }

    private static String resolveParameterName(
        String annotationName,
        String annotationValue,
        String reflectiveName,
        List<String> namesFromPathPattern,
        int indexInPattern
    ) {
        if (!annotationName.isBlank()) {
            return annotationName;
        }
        if (!annotationValue.isBlank()) {
            return annotationValue;
        }
        if (reflectiveName != null
            && !reflectiveName.isBlank()
            && !reflectiveName.startsWith("arg")) {
            return reflectiveName;
        }
        if (indexInPattern < namesFromPathPattern.size()) {
            return namesFromPathPattern.get(indexInPattern);
        }
        return "param" + indexInPattern;
    }

    private static List<String> pathVariableNamesFromPattern(String pathPattern) {
        List<String> names = new ArrayList<>();
        Matcher matcher = Pattern.compile("\\{([^}]+)\\}").matcher(pathPattern);
        while (matcher.find()) {
            names.add(matcher.group(1));
        }
        return names;
    }

    private ObjectNode queryParameter(Parameter parameter) {
        RequestParam ann = parameter.getAnnotation(RequestParam.class);
        String name = ann.name().isBlank() ? ann.value().isBlank() ? parameter.getName() : ann.value() : ann.name();
        boolean required = ann.required();
        return buildParameter("query", name, parameter, required);
    }

    private ObjectNode headerParameter(Parameter parameter) {
        RequestHeader ann = parameter.getAnnotation(RequestHeader.class);
        String name = ann.name().isBlank() ? ann.value().isBlank() ? parameter.getName() : ann.value() : ann.name();
        return buildParameter("header", name, parameter, ann.required());
    }

    private ObjectNode cookieParameter(Parameter parameter) {
        CookieValue ann = parameter.getAnnotation(CookieValue.class);
        String name = ann.name().isBlank() ? ann.value().isBlank() ? parameter.getName() : ann.value() : ann.name();
        return buildParameter("cookie", name, parameter, ann.required());
    }

    private ObjectNode buildParameter(String in, String name, Parameter parameter, boolean required) {
        ObjectNode node = mapper.createObjectNode();
        node.put("name", name);
        node.put("in", in);
        node.put("required", required);
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", simpleType(parameter.getType()));
        node.set("schema", schema);
        return node;
    }

    private static String simpleType(Class<?> type) {
        if (type == String.class || type.isEnum()) {
            return "string";
        }
        if (type == Integer.class || type == int.class
            || type == Long.class || type == long.class) {
            return "integer";
        }
        if (type == Boolean.class || type == boolean.class) {
            return "boolean";
        }
        if (type == Double.class || type == double.class
            || type == Float.class || type == float.class) {
            return "number";
        }
        return "string";
    }

    private static int defaultStatus(Method method, RequestMethod httpMethod) {
        ResponseStatus rs = AnnotatedElementUtils.findMergedAnnotation(method, ResponseStatus.class);
        if (rs != null) {
            return rs.code().value();
        }
        return switch (httpMethod) {
            case POST -> HttpStatus.CREATED.value();
            case DELETE -> HttpStatus.NO_CONTENT.value();
            default -> HttpStatus.OK.value();
        };
    }

    private boolean matchesPackage(Class<?> type) {
        List<String> basePackages = properties.getBasePackages();
        if (basePackages.isEmpty()) {
            return true;
        }
        String name = type.getPackageName();
        return basePackages.stream().anyMatch(name::startsWith);
    }

    private boolean isExcluded(String pattern) {
        for (String regex : properties.getExcludePathPatterns()) {
            if (Pattern.compile(regex).matcher(pattern).find()) {
                return true;
            }
        }
        return pattern.startsWith("/api-spector")
            || pattern.startsWith("/error")
            || pattern.contains("/actuator");
    }

    private static Set<String> patterns(RequestMappingInfo info) {
        Set<String> out = new LinkedHashSet<>();
        if (info.getPathPatternsCondition() != null) {
            info.getPathPatternsCondition().getPatterns()
                .forEach(p -> out.add(p.getPatternString()));
        }
        if (info.getPatternsCondition() != null) {
            out.addAll(info.getPatternsCondition().getPatterns());
        }
        return out;
    }

    private static Set<RequestMethod> httpMethods(RequestMappingInfo info) {
        Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
        if (methods == null || methods.isEmpty()) {
            return Set.of(RequestMethod.GET);
        }
        return methods;
    }

    private static String firstPattern(RequestMappingInfo info) {
        return patterns(info).stream().findFirst().orElse("");
    }

    private static String controllerTag(Class<?> type) {
        String simple = type.getSimpleName();
        if (simple.endsWith("Controller")) {
            simple = simple.substring(0, simple.length() - "Controller".length());
        }
        return simple.isEmpty() ? type.getName() : simple;
    }

    private static String operationId(Class<?> beanType, Method method) {
        return controllerTag(beanType) + "_" + method.getName();
    }

    private static String humanize(String name) {
        String spaced = name.replaceAll("([a-z])([A-Z])", "$1 $2").replace('_', ' ');
        if (spaced.isEmpty()) {
            return name;
        }
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }
}
