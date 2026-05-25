package io.github.apispector.starter;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ApiSpectorIndexController {

    private final ApiSpectorProperties properties;
    private final String webjarVersion;

    public ApiSpectorIndexController(ApiSpectorProperties properties, String webjarVersion) {
        this.properties = properties;
        this.webjarVersion = webjarVersion;
    }

    @GetMapping(value = "${apispector.path:/api-spector}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> index(HttpServletRequest request) throws IOException {
        ClassPathResource resource = new ClassPathResource(
            "META-INF/resources/webjars/api-spector/" + webjarVersion + "/index.html"
        );
        String html;
        try (InputStream in = resource.getInputStream()) {
            html = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        String mountPath = normalizePath(properties.getPath());
        String baseUrl = ApiSpectorServerUrlResolver.resolveFromRequest(request);
        String script = """
            <script>
            window.__API_SPECTOR_CONFIG__ = {
              specUrl: "%s",
              proxyUrl: %s,
              oauth2TokenUrl: %s,
              deepLinking: %s,
              tryItEnabled: %s,
              filter: %s,
              docExpansion: "%s",
              displayRequestDuration: %s,
              persistAuthorization: %s,
              defaultEnvironment: { url: "%s" }
            };
            </script>
            """.formatted(
            properties.getApiDocsUrl(),
            jsonString(properties.resolveEffectiveProxyUrl()),
            jsonString(properties.getOauth2TokenUrl()),
            properties.isDeepLinking(),
            properties.isTryItEnabled(),
            properties.isFilter(),
            escapeJson(properties.getDocExpansion()),
            properties.isDisplayRequestDuration(),
            properties.isPersistAuthorization(),
            escapeJson(baseUrl)
        );
        html = html.replace("</body>", script + "\n</body>");
        html = rewriteAssetPaths(html, mountPath);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    @GetMapping(value = "${apispector.path:/api-spector}/", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> indexSlash(HttpServletRequest request) throws IOException {
        return index(request);
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String rewriteAssetPaths(String html, String mountPath) {
        return html
            .replace("src=\"./assets/", "src=\"" + mountPath + "/assets/")
            .replace("href=\"./assets/", "href=\"" + mountPath + "/assets/");
    }

    private static String jsonString(String value) {
        if (value == null || value.isBlank()) {
            return "null";
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "/api-spector";
        }
        String p = path.startsWith("/") ? path : "/" + path;
        if (p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }
}
