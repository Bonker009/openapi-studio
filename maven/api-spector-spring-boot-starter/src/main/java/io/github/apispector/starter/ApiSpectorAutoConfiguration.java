package io.github.apispector.starter;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.apispector.scanner.ApiSpectorScanProperties;
import io.github.apispector.scanner.ApiSpectorScanner;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.env.Environment;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass(DispatcherServlet.class)
@Conditional(ApiSpectorEnabledCondition.class)
@EnableConfigurationProperties(ApiSpectorProperties.class)
public class ApiSpectorAutoConfiguration implements WebMvcConfigurer {

    private final ApiSpectorProperties properties;
    private final String webjarVersion;

    public ApiSpectorAutoConfiguration(ApiSpectorProperties properties) {
        this.properties = properties;
        this.webjarVersion = resolveWebjarVersion();
    }

    private static String resolveWebjarVersion() {
        try (InputStream in =
                ApiSpectorAutoConfiguration.class.getResourceAsStream(
                    "/META-INF/api-spector/webjar-version.txt")) {
            if (in != null) {
                String version = new String(in.readAllBytes(), StandardCharsets.UTF_8).trim();
                if (!version.isEmpty() && !version.contains("@")) {
                    return version;
                }
            }
        } catch (IOException ignored) {
            // fall through
        }
        Package pkg = ApiSpectorAutoConfiguration.class.getPackage();
        String implVersion = pkg != null ? pkg.getImplementationVersion() : null;
        return implVersion != null && !implVersion.isBlank() ? implVersion : "0.1.0";
    }

    @Bean
    ApiSpectorScanProperties apiSpectorScanProperties(Environment env) {
        ApiSpectorScanProperties scan = new ApiSpectorScanProperties();
        ApiSpectorProperties.Info info = properties.getInfo();
        scan.setTitle(
            info.getTitle() != null ? info.getTitle() : env.getProperty("spring.application.name", "API")
        );
        scan.setVersion(
            info.getVersion() != null ? info.getVersion() : env.getProperty("spring.application.version", "0.0.0")
        );
        scan.setDescription(info.getDescription());
        if (!info.getServers().isEmpty()) {
            scan.setServers(info.getServers());
        } else {
            scan.getServers().add(ApiSpectorServerUrlResolver.resolveFromEnvironment(env));
        }
        scan.setBasePackages(properties.getScan().getBasePackages());
        scan.setExcludePathPatterns(properties.getScan().getExcludePathPatterns());
        return scan;
    }

    @Bean
    ApiSpectorScanner apiSpectorScanner(
        ObjectMapper objectMapper,
        ObjectProvider<RequestMappingHandlerMapping> handlerMappingProvider,
        ApiSpectorScanProperties scanProperties
    ) {
        return new ApiSpectorScanner(objectMapper, handlerMappingProvider, scanProperties);
    }

    @Bean
    ApiSpectorApiDocsController apiSpectorApiDocsController(ApiSpectorScanner scanner) {
        return new ApiSpectorApiDocsController(scanner);
    }

    @Bean
    ApiSpectorIndexController apiSpectorIndexController() {
        return new ApiSpectorIndexController(properties, webjarVersion);
    }

    @Bean
    ApiSpectorProxyController apiSpectorProxyController(ObjectMapper objectMapper) {
        return new ApiSpectorProxyController(objectMapper);
    }

    @Bean
    ApiSpectorStartupReporter apiSpectorStartupReporter() {
        return new ApiSpectorStartupReporter(properties);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String base = normalizePath(properties.getPath());
        registry
            .addResourceHandler(base + "/**")
            .addResourceLocations(
                "classpath:/META-INF/resources/webjars/api-spector/" + webjarVersion + "/"
            );
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        if (!ApiSpectorSecurityInterceptor.isConfigured(properties.getSecurity())) {
            return;
        }
        String mount = normalizePath(properties.getPath());
        String docs = properties.getApiDocsUrl();
        registry
            .addInterceptor(
                new ApiSpectorSecurityInterceptor(
                    properties.getSecurity().getUsername(),
                    properties.getSecurity().getPassword()
                )
            )
            .addPathPatterns(mount, mount + "/", mount + "/**", docs, mount + "/proxy");
    }

    private static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "/api-spector";
        }
        return path.startsWith("/") ? path : "/" + path;
    }
}
