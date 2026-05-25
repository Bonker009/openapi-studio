package io.github.apispector.scanner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

public class ApiSpectorScanner {

    private final ObjectMapper objectMapper;
    private final ObjectProvider<RequestMappingHandlerMapping> handlerMappingProvider;
    private final ApiSpectorScanProperties properties;
    private volatile ObjectNode cached;

    public ApiSpectorScanner(
        ObjectMapper objectMapper,
        ObjectProvider<RequestMappingHandlerMapping> handlerMappingProvider,
        ApiSpectorScanProperties properties
    ) {
        this.objectMapper = objectMapper;
        this.handlerMappingProvider = handlerMappingProvider;
        this.properties = properties;
    }

    public ObjectNode getOpenApiDocument() {
        ObjectNode doc = cached;
        if (doc != null) {
            return doc;
        }
        synchronized (this) {
            if (cached != null) {
                return cached;
            }
            RequestMappingHandlerMapping mapping = handlerMappingProvider.getIfAvailable();
            if (mapping == null) {
                throw new IllegalStateException("RequestMappingHandlerMapping is not available");
            }
            cached = new OpenApiSpecBuilder(objectMapper, properties).build(mapping);
            return cached;
        }
    }

    public void invalidate() {
        cached = null;
    }
}
