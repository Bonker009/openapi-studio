package io.github.apispector.starter;

import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.env.Environment;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.StringUtils;

/**
 * Enables api-spector unless explicitly disabled or a production profile is active
 * without an explicit {@code apispector.enabled=true}.
 */
public class ApiSpectorEnabledCondition implements Condition {

    private static final Logger log = LoggerFactory.getLogger(ApiSpectorEnabledCondition.class);
    private static final List<String> DEFAULT_PRODUCTION_PROFILES = List.of("prod", "production");

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        Environment env = context.getEnvironment();
        String explicit = env.getProperty("apispector.enabled");
        if (StringUtils.hasText(explicit)) {
            return Boolean.parseBoolean(explicit.trim());
        }

        List<String> productionProfiles = resolveProductionProfiles(env);
        for (String active : env.getActiveProfiles()) {
            String lower = active.toLowerCase();
            if (productionProfiles.contains(lower)) {
                log.info(
                    "api-spector auto-disabled because profile '{}' is active. "
                        + "Set apispector.enabled=true to override.",
                    active
                );
                return false;
            }
        }
        return true;
    }

    private static List<String> resolveProductionProfiles(Environment env) {
        String raw = env.getProperty("apispector.production-profiles");
        if (!StringUtils.hasText(raw)) {
            return DEFAULT_PRODUCTION_PROFILES;
        }
        return Arrays.stream(raw.split(","))
            .map(String::trim)
            .filter(StringUtils::hasText)
            .map(String::toLowerCase)
            .toList();
    }
}
