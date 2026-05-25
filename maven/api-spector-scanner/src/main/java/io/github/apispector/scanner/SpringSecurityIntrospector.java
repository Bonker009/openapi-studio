package io.github.apispector.scanner;

import java.lang.annotation.Annotation;
import java.lang.reflect.AnnotatedElement;
import java.lang.reflect.Method;

public final class SpringSecurityIntrospector {

    private static final String[] SECURITY_ANNOTATIONS = {
        "org.springframework.security.access.prepost.PreAuthorize",
        "org.springframework.security.access.prepost.PostAuthorize",
        "org.springframework.security.access.annotation.Secured",
        "jakarta.annotation.security.RolesAllowed",
        "javax.annotation.security.RolesAllowed",
    };

    private SpringSecurityIntrospector() {}

    public static boolean requiresAuth(Method method, Class<?> beanType) {
        return hasSecurityAnnotation(method) || hasSecurityAnnotation(beanType);
    }

    private static boolean hasSecurityAnnotation(AnnotatedElement element) {
        for (String name : SECURITY_ANNOTATIONS) {
            if (findAnnotation(element, name) != null) {
                return true;
            }
        }
        return false;
    }

    private static Annotation findAnnotation(AnnotatedElement element, String className) {
        try {
            Class<?> type = Class.forName(className);
            return element.getAnnotation(type.asSubclass(Annotation.class));
        } catch (ClassNotFoundException | ClassCastException ignored) {
            return null;
        }
    }
}
