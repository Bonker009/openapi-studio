package io.github.apispector.starter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;

/**
 * Logs api-spector URLs after the web server is ready (similar to Spring Boot's own startup lines).
 */
public class ApiSpectorStartupReporter implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(ApiSpectorStartupReporter.class);

    private final ApiSpectorProperties properties;

    public ApiSpectorStartupReporter(ApiSpectorProperties properties) {
        this.properties = properties;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        Environment env = event.getApplicationContext().getEnvironment();
        String base = ApiSpectorServerUrlResolver.resolveFromEnvironment(env);
        String mount = normalizeMountPath(properties.getPath());
        String ui = joinUrl(base, mount);
        String docs = joinUrl(base, properties.getApiDocsUrl());
        String proxy = joinUrl(base, properties.resolveEffectiveProxyUrl());

        log.info("api-spector playground: {}", ui);
        log.info("api-spector OpenAPI:   {}", docs);
        log.info("api-spector proxy:     {}", proxy);
        if (ApiSpectorSecurityInterceptor.isConfigured(properties.getSecurity())) {
            log.info("api-spector security:  HTTP Basic enabled on UI, OpenAPI, and proxy");
        }
    }

    private static String normalizeMountPath(String path) {
        if (path == null || path.isBlank()) {
            return "/api-spector";
        }
        String p = path.startsWith("/") ? path : "/" + path;
        while (p.endsWith("/") && p.length() > 1) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }

    private static String joinUrl(String base, String path) {
        if (path == null || path.isBlank()) {
            return base;
        }
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }
        String segment = path.startsWith("/") ? path : "/" + path;
        return base + segment;
    }
}
