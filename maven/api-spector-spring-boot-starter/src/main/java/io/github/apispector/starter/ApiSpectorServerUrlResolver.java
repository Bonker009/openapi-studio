package io.github.apispector.starter;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;

/**
 * Resolves the API base URL for OpenAPI {@code servers} and SPA {@code defaultEnvironment}.
 */
public final class ApiSpectorServerUrlResolver {

    private ApiSpectorServerUrlResolver() {}

    public static String resolveFromRequest(HttpServletRequest request) {
        StringBuffer url = request.getRequestURL();
        String uri = request.getRequestURI();
        if (uri != null && !uri.isEmpty()) {
            int idx = url.indexOf(uri);
            if (idx > 0) {
                return stripTrailingSlash(url.substring(0, idx));
            }
        }
        return stripTrailingSlash(url.toString());
    }

    /** Fallback when no HTTP request is available (e.g. building api-docs at startup). */
    public static String resolveFromEnvironment(Environment env) {
        String port = env.getProperty("local.server.port");
        if (port == null || port.isBlank()) {
            port = env.getProperty("server.port", "8080");
        }
        String contextPath = normalizeContextPath(
            env.getProperty("server.servlet.context-path", "")
        );
        return "http://localhost:" + port + contextPath;
    }

    private static String normalizeContextPath(String contextPath) {
        if (contextPath == null || contextPath.isBlank() || "/".equals(contextPath)) {
            return "";
        }
        String path = contextPath.startsWith("/") ? contextPath : "/" + contextPath;
        return stripTrailingSlash(path);
    }

    private static String stripTrailingSlash(String url) {
        if (url == null || url.isEmpty()) {
            return url;
        }
        while (url.endsWith("/") && url.length() > 1) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }
}
