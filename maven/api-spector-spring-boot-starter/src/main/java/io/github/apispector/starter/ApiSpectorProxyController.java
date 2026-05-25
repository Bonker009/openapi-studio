package io.github.apispector.starter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.Part;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApiSpectorProxyController {

    private static final Set<String> ALLOWED_METHODS = Set.of(
        "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
    );
    private static final int MAX_BODY_BYTES = 5 * 1024 * 1024;
    private static final Duration TIMEOUT = Duration.ofSeconds(60);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ApiSpectorProxyController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    }

    @PostMapping(
        value = "${apispector.path:/api-spector}/proxy",
        consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<Map<String, Object>> proxyJson(@RequestBody ProxyPayload payload) {
        try {
            return ResponseEntity.ok(forwardJson(payload));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(errorResult(ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.ok(
                errorResult(ex.getMessage() != null ? ex.getMessage() : "Proxy failed")
            );
        }
    }

    @PostMapping(
        value = "${apispector.path:/api-spector}/proxy",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>> proxyMultipart(HttpServletRequest request) {
        try {
            return ResponseEntity.ok(forwardMultipart(request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(errorResult(ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.ok(
                errorResult(ex.getMessage() != null ? ex.getMessage() : "Proxy failed")
            );
        }
    }

    private Map<String, Object> forwardJson(ProxyPayload payload) throws Exception {
        String url = payload.url == null ? "" : payload.url.trim();
        if (url.isEmpty()) {
            return errorResult("URL is required");
        }
        assertAllowedTarget(url);

        String method = (payload.method == null ? "GET" : payload.method).toUpperCase(Locale.ROOT);
        if (!ALLOWED_METHODS.contains(method)) {
            return errorResult("HTTP method not allowed");
        }

        byte[] bodyBytes = null;
        if (payload.body != null && !Set.of("GET", "HEAD").contains(method)) {
            bodyBytes = payload.body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (bodyBytes.length > MAX_BODY_BYTES) {
                return errorResult("Request body too large");
            }
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
            .timeout(TIMEOUT)
            .method(
                method,
                bodyBytes == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofByteArray(bodyBytes)
            );

        applyHeaders(builder, payload.headers);
        return execute(builder.build());
    }

    private Map<String, Object> forwardMultipart(HttpServletRequest request) throws Exception {
        String url = null;
        String method = "GET";
        Map<String, String> headers = new LinkedHashMap<>();
        byte[] bodyBytes = null;

        for (Part part : request.getParts()) {
            String name = part.getName();
            if ("_proxy_url".equals(name)) {
                url = readPartText(part).trim();
            } else if ("_proxy_method".equals(name)) {
                method = readPartText(part).trim().toUpperCase(Locale.ROOT);
            } else if ("_proxy_headers".equals(name)) {
                String raw = readPartText(part);
                if (!raw.isBlank()) {
                    JsonNode node = objectMapper.readTree(raw);
                    node.fields().forEachRemaining(e -> headers.put(e.getKey(), e.getValue().asText()));
                }
            } else if ("_proxy_body".equals(name)) {
                bodyBytes = part.getInputStream().readAllBytes();
            }
        }

        if (url == null || url.isEmpty()) {
            return errorResult("URL is required");
        }
        assertAllowedTarget(url);
        if (!ALLOWED_METHODS.contains(method)) {
            return errorResult("HTTP method not allowed");
        }
        if (bodyBytes != null && bodyBytes.length > MAX_BODY_BYTES) {
            return errorResult("Request body too large");
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
            .timeout(TIMEOUT)
            .method(
                method,
                bodyBytes == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofByteArray(bodyBytes)
            );
        applyHeaders(builder, headers);
        return execute(builder.build());
    }

    private Map<String, Object> execute(HttpRequest request) throws Exception {
        long start = System.nanoTime();
        HttpResponse<byte[]> response = httpClient.send(
            request,
            HttpResponse.BodyHandlers.ofByteArray()
        );
        int responseTime = (int) ((System.nanoTime() - start) / 1_000_000L);

        if (response.statusCode() >= 300 && response.statusCode() < 400) {
            return Map.of(
                "data", null,
                "status", 0,
                "statusText", "Redirect not followed",
                "headers", Map.of(),
                "responseTime", responseTime,
                "error", "Redirects are not followed for security. Use the final URL directly."
            );
        }

        Map<String, String> responseHeaders = new LinkedHashMap<>();
        response.headers().map().forEach((k, values) -> {
            if (!values.isEmpty()) {
                responseHeaders.put(k, values.get(0));
            }
        });

        byte[] body = response.body();
        if (body.length > MAX_BODY_BYTES) {
            return Map.of(
                "data", null,
                "status", 0,
                "statusText", "Response too large",
                "headers", responseHeaders,
                "responseTime", responseTime,
                "error", "Response exceeds size limit"
            );
        }

        Object data = parseBody(body, responseHeaders.get("Content-Type"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", data);
        result.put("status", response.statusCode());
        result.put("statusText", "");
        result.put("headers", responseHeaders);
        result.put("responseTime", responseTime);
        if (response.statusCode() >= 400) {
            result.put("error", "HTTP " + response.statusCode());
        }
        return result;
    }

    private Object parseBody(byte[] body, String contentType) {
        if (body.length == 0) {
            return null;
        }
        String text = new String(body, java.nio.charset.StandardCharsets.UTF_8);
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).contains("json")) {
            try {
                return objectMapper.readValue(text, Object.class);
            } catch (Exception ignored) {
                /* fall through */
            }
        }
        try {
            return objectMapper.readValue(text, Object.class);
        } catch (Exception ignored) {
            return text;
        }
    }

    private static void applyHeaders(HttpRequest.Builder builder, Map<String, String> headers) {
        if (headers == null) {
            return;
        }
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            String key = entry.getKey();
            if (key == null) {
                continue;
            }
            String lower = key.toLowerCase(Locale.ROOT);
            if (lower.equals("host") || lower.startsWith("proxy-")) {
                continue;
            }
            builder.header(key, entry.getValue());
        }
    }

    private static void assertAllowedTarget(String url) {
        URI uri = URI.create(url);
        String scheme = uri.getScheme();
        if (scheme == null
            || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
            throw new IllegalArgumentException("Only http and https URLs are allowed");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("URL host is required");
        }
        String lower = host.toLowerCase(Locale.ROOT);
        if (lower.equals("localhost")
            || lower.equals("127.0.0.1")
            || lower.equals("::1")
            || lower.equals("[::1]")
            || isPrivateIpv4(lower)) {
            return;
        }
        throw new IllegalArgumentException(
            "Proxy target host not allowed: " + host + ". Use localhost or a private IP."
        );
    }

    private static boolean isPrivateIpv4(String host) {
        String[] parts = host.split("\\.");
        if (parts.length != 4) {
            return false;
        }
        try {
            int a = Integer.parseInt(parts[0]);
            int b = Integer.parseInt(parts[1]);
            if (a == 10) return true;
            if (a == 172 && b >= 16 && b <= 31) return true;
            if (a == 192 && b == 168) return true;
        } catch (NumberFormatException ignored) {
            return false;
        }
        return false;
    }

    private static String readPartText(Part part) throws Exception {
        return new String(part.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    }

    private static Map<String, Object> errorResult(String message) {
        return Map.of(
            "data", null,
            "status", 0,
            "statusText", "Proxy error",
            "headers", Map.of(),
            "responseTime", 0,
            "error", message
        );
    }

    public static class ProxyPayload {
        public String url;
        public String method;
        public Map<String, String> headers;
        public String body;
    }
}
