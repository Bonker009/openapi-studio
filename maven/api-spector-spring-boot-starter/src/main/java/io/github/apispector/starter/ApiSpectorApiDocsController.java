package io.github.apispector.starter;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.apispector.scanner.ApiSpectorScanner;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApiSpectorApiDocsController {

    private final ApiSpectorScanner scanner;

    public ApiSpectorApiDocsController(ApiSpectorScanner scanner) {
        this.scanner = scanner;
    }

    @GetMapping(value = "${apispector.api-docs-url:/api-spector/api-docs}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ObjectNode apiDocs() {
        return scanner.getOpenApiDocument();
    }
}
