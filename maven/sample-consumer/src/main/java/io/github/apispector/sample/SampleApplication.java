package io.github.apispector.sample;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
public class SampleApplication {

    public static void main(String[] args) {
        SpringApplication.run(SampleApplication.class, args);
    }

    public record UserDto(
        @NotBlank String name,
        @Email String email,
        @Min(0) int age
    ) {}

    @RestController
    @RequestMapping("/api/v1/users")
    static class UserController {

        @GetMapping("/{id}")
        UserDto get(@PathVariable("id") UUID id) {
            return new UserDto("Ada", "ada@example.com", 30);
        }

        @PostMapping
        @PreAuthorize("hasRole('ADMIN')")
        UserDto create(@Valid @RequestBody UserDto body) {
            return body;
        }

        @GetMapping("/health")
        Map<String, String> health() {
            return Map.of("status", "ok");
        }
    }
}
