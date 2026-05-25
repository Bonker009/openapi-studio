package io.github.apispector.sample;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.apispector.scanner.ApiSpectorScanner;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "apispector.enabled=false")
class ApiSpectorDisabledIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void uiAndApiDocsReturn404WhenDisabled() throws Exception {
        mockMvc.perform(get("/api-spector")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api-spector/api-docs")).andExpect(status().isNotFound());
    }
}

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(
    properties = {
        "apispector.security.username=dev",
        "apispector.security.password=secret"
    }
)
class ApiSpectorSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void requiresBasicAuthWithoutCredentials() throws Exception {
        mockMvc.perform(get("/api-spector")).andExpect(status().isUnauthorized());
    }

    @Test
    void allowsWithValidBasicAuth() throws Exception {
        String encoded = Base64.getEncoder().encodeToString("dev:secret".getBytes());
        mockMvc
            .perform(get("/api-spector").header("Authorization", "Basic " + encoded))
            .andExpect(status().isOk());
    }
}

@SpringBootTest
@ActiveProfiles("prod")
class ApiSpectorProdProfileIntegrationTest {

    @Autowired(required = false)
    private ApiSpectorScanner scanner;

    @Test
    void autoDisabledOnProdProfile() {
        assertThat(scanner).isNull();
    }
}
