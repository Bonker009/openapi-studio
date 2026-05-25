# api-spector

Interactive API playground for Spring Boot applications. Add one dependency, open `/api-spector`, and explore every `@RestController` endpoint with try-it requests, smoke tests, and OpenAPI 3.1 schemas generated from your Jackson DTOs.

No database. No springdoc. No Swagger annotations required.

## Maven

```xml
<dependency>
  <groupId>io.github.apispector</groupId>
  <artifactId>api-spector-spring-boot-starter</artifactId>
  <version>0.1.0-SNAPSHOT</version>
</dependency>
```

## Gradle (Kotlin DSL)

```kotlin
implementation("io.github.apispector:api-spector-spring-boot-starter:0.1.0-SNAPSHOT")
```

## Quick start

1. Add the dependency above to your Spring Boot 3.x app.
2. Run the application.
3. Open `http://localhost:8080/api-spector`.

OpenAPI JSON is served at `/api-spector/api-docs`, built by scanning `RequestMappingHandlerMapping` and reflecting request/response types with [victools/jsonschema-generator](https://github.com/victools/jsonschema-generator).

## Configuration

```yaml
apispector:
  enabled: true                    # false to disable; auto-off on prod profile if unset
  production-profiles: prod,production
  path: /api-spector
  api-docs-url: /api-spector/api-docs
  try-it-enabled: true             # false = read-only docs in UI
  filter: true
  doc-expansion: list              # list | full | none
  deep-linking: true
  security:                        # optional HTTP Basic on UI + api-docs + proxy
    username: dev
    password: secret
  info:
    title: My API
    version: 1.0.0
  scan:
    base-packages: []
    exclude-path-patterns: []
```

See [docs/CONSUMER.md](docs/CONSUMER.md) for the full property list and production checklist.

## Repository layout

| Path | Description |
|------|-------------|
| `apps/api-spector-spa/` | Vite + React UI (WebJar source) |
| `maven/api-spector-scanner/` | Spring MVC annotation → OpenAPI 3.1 scanner |
| `maven/api-spector-webjar/` | Packages SPA into `META-INF/resources/webjars/api-spector/` |
| `maven/api-spector-spring-boot-starter/` | Auto-configuration + UI + api-docs endpoints |
| `maven/sample-consumer/` | Example Spring Boot app + integration tests |

## Build from source

```bash
# UI
cd apps/api-spector-spa && npm install && npm run build

# Java modules + tests
mvn -f maven/pom.xml clean verify
```

Or from the repo root (requires Node.js and Maven):

```bash
npm install --prefix apps/api-spector-spa
npm run build
```

```bash
mvn -f maven/pom.xml clean verify
```

## Standalone SPA embed

The built bundle exposes `window.ApiSpector.init(options)`:

```html
<div id="api-spector" style="height:100vh"></div>
<script src="/api-spector/assets/index-*.js"></script>
<script>
  ApiSpector.init({
    domNode: "#api-spector",
    specUrl: "/api-spector/api-docs",
    defaultEnvironment: { url: window.location.origin }
  });
</script>
```

## License

See repository license file.
