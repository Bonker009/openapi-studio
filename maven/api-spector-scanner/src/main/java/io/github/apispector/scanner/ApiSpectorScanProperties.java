package io.github.apispector.scanner;

import java.util.ArrayList;
import java.util.List;

public class ApiSpectorScanProperties {

    private String title = "API";
    private String version = "0.0.0";
    private String description;
    private List<String> servers = new ArrayList<>();
    private List<String> basePackages = new ArrayList<>();
    private List<String> excludePathPatterns = new ArrayList<>();

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
        this.excludePathPatterns = excludePathPatterns != null ? excludePathPatterns : new ArrayList<>();
    }
}
