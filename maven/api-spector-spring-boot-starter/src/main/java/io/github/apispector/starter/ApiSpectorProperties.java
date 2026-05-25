package io.github.apispector.starter;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "apispector")
public class ApiSpectorProperties {

    /** When unset, enabled unless a production profile is active. */
    private Boolean enabled;
    private String path = "/api-spector";
    private String apiDocsUrl = "/api-spector/api-docs";
    private String proxyUrl;
    private String oauth2TokenUrl;
    private boolean deepLinking = true;
    private boolean tryItEnabled = true;
    private boolean filter = true;
    private String docExpansion = "list";
    private boolean displayRequestDuration = true;
    private boolean persistAuthorization = false;
    private List<String> productionProfiles = new ArrayList<>(List.of("prod", "production"));
    private Info info = new Info();
    private Scan scan = new Scan();
    private Security security = new Security();

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getApiDocsUrl() {
        return apiDocsUrl;
    }

    public void setApiDocsUrl(String apiDocsUrl) {
        this.apiDocsUrl = apiDocsUrl;
    }

    public String getProxyUrl() {
        return proxyUrl;
    }

    public void setProxyUrl(String proxyUrl) {
        this.proxyUrl = proxyUrl;
    }

    public String resolveEffectiveProxyUrl() {
        if (proxyUrl != null && !proxyUrl.isBlank()) {
            return proxyUrl.trim();
        }
        return normalizeMountPath(path) + "/proxy";
    }

    public String getOauth2TokenUrl() {
        return oauth2TokenUrl;
    }

    public void setOauth2TokenUrl(String oauth2TokenUrl) {
        this.oauth2TokenUrl = oauth2TokenUrl;
    }

    public boolean isDeepLinking() {
        return deepLinking;
    }

    public void setDeepLinking(boolean deepLinking) {
        this.deepLinking = deepLinking;
    }

    public boolean isTryItEnabled() {
        return tryItEnabled;
    }

    public void setTryItEnabled(boolean tryItEnabled) {
        this.tryItEnabled = tryItEnabled;
    }

    public boolean isFilter() {
        return filter;
    }

    public void setFilter(boolean filter) {
        this.filter = filter;
    }

    public String getDocExpansion() {
        return docExpansion;
    }

    public void setDocExpansion(String docExpansion) {
        this.docExpansion = docExpansion;
    }

    public boolean isDisplayRequestDuration() {
        return displayRequestDuration;
    }

    public void setDisplayRequestDuration(boolean displayRequestDuration) {
        this.displayRequestDuration = displayRequestDuration;
    }

    public boolean isPersistAuthorization() {
        return persistAuthorization;
    }

    public void setPersistAuthorization(boolean persistAuthorization) {
        this.persistAuthorization = persistAuthorization;
    }

    public List<String> getProductionProfiles() {
        return productionProfiles;
    }

    public void setProductionProfiles(List<String> productionProfiles) {
        this.productionProfiles =
            productionProfiles != null ? productionProfiles : new ArrayList<>();
    }

    public Info getInfo() {
        return info;
    }

    public void setInfo(Info info) {
        this.info = info;
    }

    public Scan getScan() {
        return scan;
    }

    public void setScan(Scan scan) {
        this.scan = scan;
    }

    public Security getSecurity() {
        return security;
    }

    public void setSecurity(Security security) {
        this.security = security != null ? security : new Security();
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

    public static class Info {
        private String title;
        private String version;
        private String description;
        private List<String> servers = new ArrayList<>();

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getVersion() {
            return version;
        }

        public void setVersion(String version) {
            this.version = version;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public List<String> getServers() {
            return servers;
        }

        public void setServers(List<String> servers) {
            this.servers = servers != null ? servers : new ArrayList<>();
        }
    }

    public static class Scan {
        private List<String> basePackages = new ArrayList<>();
        private List<String> excludePathPatterns = new ArrayList<>();

        public List<String> getBasePackages() {
            return basePackages;
        }

        public void setBasePackages(List<String> basePackages) {
            this.basePackages = basePackages != null ? basePackages : new ArrayList<>();
        }

        public List<String> getExcludePathPatterns() {
            return excludePathPatterns;
        }

        public void setExcludePathPatterns(List<String> excludePathPatterns) {
            this.excludePathPatterns =
                excludePathPatterns != null ? excludePathPatterns : new ArrayList<>();
        }
    }

    public static class Security {
        private String username;
        private String password;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }
}
