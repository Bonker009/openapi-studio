package io.github.apispector.sample;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class ApiSpectorIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @LocalServerPort
    private int port;

    @Test
    void getUserByIdBindsPathVariable() throws Exception {
        mockMvc
            .perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                    .get("/api/v1/users/123e4567-e89b-12d3-a456-426614174000")
            )
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .status().isOk());
    }

    @Test
    void apiDocsListsScannedEndpoints() throws Exception {
        MvcResult result = mockMvc
            .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api-spector/api-docs"))
            .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"/api/v1/users/{id}\"");
        assertThat(body).contains("\"name\":\"id\"");
        assertThat(body).contains("\"in\":\"path\"");
        assertThat(body).contains("\"post\"");
        assertThat(body).contains("bearerAuth");
        assertThat(body).contains("UserDto");
    }

    @Test
    void playgroundIndexBootstrapsApiSpector() throws Exception {
        MvcResult result = mockMvc
            .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api-spector"))
            .andReturn();

        String html = result.getResponse().getContentAsString();
        assertThat(html).contains("__API_SPECTOR_CONFIG__");
        assertThat(html).contains("/api-spector/api-docs");
        assertThat(html).contains("defaultEnvironment");
        assertThat(html).contains("/api-spector/proxy");
    }

    @Test
    void builtInProxyForwardsToLocalApi() throws Exception {
        String target = "http://127.0.0.1:" + port + "/api/v1/users/health";
        String payload =
            "{\"url\":\"" + target + "\",\"method\":\"GET\"}";

        String body = mockMvc
            .perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                    .post("/api-spector/proxy")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload)
            )
            .andReturn()
            .getResponse()
            .getContentAsString();

        assertThat(body).contains("\"status\":200");
        assertThat(body).contains("ok");
    }

    @Test
    void apiDocsIncludesResolvedServerUrl() throws Exception {
        MvcResult result = mockMvc
            .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api-spector/api-docs"))
            .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"servers\"");
        assertThat(body).doesNotContain("\"url\":\"/\"");
        assertThat(body).contains("http://localhost");
    }
}
