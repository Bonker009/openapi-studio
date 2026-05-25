package io.github.apispector.starter;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.apispector.scanner.ApiSpectorScanner;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest(classes = ApiSpectorAutoConfigurationTest.TestBootApp.class)
class ApiSpectorAutoConfigurationTest {

    @Autowired
    private ApiSpectorScanner scanner;

    @Test
    void scannerBeanIsRegistered() {
        assertThat(scanner.getOpenApiDocument().get("openapi").asText()).isEqualTo("3.1.0");
        assertThat(scanner.getOpenApiDocument().toString()).contains("/hello");
    }

    @SpringBootApplication
    static class TestBootApp {
        static void main(String[] args) {
            SpringApplication.run(TestBootApp.class, args);
        }

        @RestController
        static class HelloController {
            @GetMapping("/hello")
            String hello() {
                return "hi";
            }
        }
    }
}
