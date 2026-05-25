package io.github.apispector.starter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Optional HTTP Basic protection for api-spector UI, api-docs, and proxy endpoints.
 */
public class ApiSpectorSecurityInterceptor implements HandlerInterceptor {

    private final String expectedUsername;
    private final byte[] expectedPasswordBytes;

    public ApiSpectorSecurityInterceptor(String username, String password) {
        this.expectedUsername = username;
        this.expectedPasswordBytes = password.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public boolean preHandle(
        HttpServletRequest request,
        HttpServletResponse response,
        Object handler
    ) throws Exception {
        String auth = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (auth != null && auth.regionMatches(true, 0, "Basic ", 0, 6)) {
            String token = auth.substring(6).trim();
            try {
                String decoded = new String(Base64.getDecoder().decode(token), StandardCharsets.UTF_8);
                int colon = decoded.indexOf(':');
                if (colon > 0) {
                    String user = decoded.substring(0, colon);
                    String pass = decoded.substring(colon + 1);
                    if (constantTimeEquals(user, expectedUsername)
                        && constantTimeEqualsBytes(
                            pass.getBytes(StandardCharsets.UTF_8),
                            expectedPasswordBytes
                        )) {
                        return true;
                    }
                }
            } catch (IllegalArgumentException ignored) {
                /* invalid base64 */
            }
        }

        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Basic realm=\"api-spector\"");
        response.sendError(HttpStatus.UNAUTHORIZED.value(), "Unauthorized");
        return false;
    }

    private static boolean constantTimeEquals(String a, String b) {
        return constantTimeEqualsBytes(
            a.getBytes(StandardCharsets.UTF_8),
            b.getBytes(StandardCharsets.UTF_8)
        );
    }

    private static boolean constantTimeEqualsBytes(byte[] a, byte[] b) {
        return MessageDigest.isEqual(a, b);
    }

    public static boolean isConfigured(ApiSpectorProperties.Security security) {
        return security != null
            && StringUtils.hasText(security.getUsername())
            && StringUtils.hasText(security.getPassword());
    }
}
