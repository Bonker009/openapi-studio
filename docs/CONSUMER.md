# api-spector consumer guide

## Maven

```xml
<dependency>
  <groupId>io.github.bonker009</groupId>
  <artifactId>api-spector-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

## Gradle (Kotlin DSL)

```kotlin
dependencies {
    implementation("io.github.bonker009:api-spector-spring-boot-starter:0.1.0")
}
```

## Gradle (Groovy)

```groovy
dependencies {
    implementation 'io.github.bonker009:api-spector-spring-boot-starter:0.1.0'
}
```

## Spring MVC note

For `@PathVariable` / `@RequestParam` without an explicit name (e.g. `@PathVariable UUID id`), compile with Java parameter names enabled:

**Maven**

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <parameters>true</parameters>
  </configuration>
</plugin>
```

Or name variables explicitly: `@PathVariable("id") UUID id`.

## What you get

| URL | Content |
|-----|---------|
| `/api-spector` | Interactive playground UI |
| `/api-spector/api-docs` | OpenAPI 3.1 JSON from your `@RestController` mappings |
| `/api-spector/proxy` | Built-in try-it proxy (same-origin fallback) |

Endpoints are discovered from Spring MVC (`@GetMapping`, `@PostMapping`, `@RequestBody`, etc.). Jackson DTOs become JSON Schema via victools. Methods or classes annotated with `@PreAuthorize` / `@Secured` / `@RolesAllowed` show as secured in the spec.

## Configuration properties

| Property | Default | Description |
|----------|---------|-------------|
| `apispector.enabled` | *(unset → on)* | Master switch. Set `false` to disable UI, api-docs, and proxy. |
| `apispector.production-profiles` | `prod,production` | When `enabled` is unset and any listed profile is active, api-spector auto-disables. |
| `apispector.path` | `/api-spector` | UI mount path |
| `apispector.api-docs-url` | `/api-spector/api-docs` | OpenAPI JSON endpoint |
| `apispector.proxy-url` | *(built-in)* | Override try-it proxy URL (default: `{path}/proxy`) |
| `apispector.oauth2-token-url` | — | Optional OAuth2 client-credentials helper URL for the UI |
| `apispector.deep-linking` | `true` | Sync selected endpoint to URL hash |
| `apispector.try-it-enabled` | `true` | When `false`, UI is read-only (no Execute button) |
| `apispector.filter` | `true` | Show sidebar endpoint search |
| `apispector.doc-expansion` | `list` | `list` \| `full` \| `none` — default tag expansion |
| `apispector.display-request-duration` | `true` | Show response time in try-it panel |
| `apispector.persist-authorization` | `false` | Persist credentials in browser localStorage |
| `apispector.security.username` | — | Optional HTTP Basic auth username |
| `apispector.security.password` | — | Optional HTTP Basic auth password |
| `apispector.info.title` | `spring.application.name` | OpenAPI title |
| `apispector.info.version` | `0.0.0` | OpenAPI version |
| `apispector.info.description` | — | OpenAPI description |
| `apispector.info.servers` | auto localhost URL | OpenAPI server URLs |
| `apispector.scan.base-packages` | all controllers | Limit scanned packages |
| `apispector.scan.exclude-path-patterns` | — | Regex patterns to exclude paths |

### Example `application.yml`

```yaml
apispector:
  enabled: true
  path: /api-spector
  try-it-enabled: true
  filter: true
  doc-expansion: list
  info:
    title: Orders API
    version: 2.1.0
    servers:
      - http://localhost:8080
  scan:
    base-packages:
      - com.example.orders
    exclude-path-patterns:
      - /internal/.*
  security:
    username: ${API_SPECTOR_USER:}
    password: ${API_SPECTOR_PASSWORD:}
```

## Production checklist

1. **Disable in production** (recommended for public internet):
   ```yaml
   apispector:
     enabled: false
   ```
   Or rely on auto-disable when `spring.profiles.active` includes `prod` or `production` (override with `enabled: true` only if intentional).

2. **Protect with HTTP Basic** when enabled on staging:
   ```yaml
   apispector:
     security:
       username: ${API_SPECTOR_USER}
       password: ${API_SPECTOR_PASSWORD}
   ```

3. **Read-only docs** (no try-it from browser):
   ```yaml
   apispector:
     try-it-enabled: false
   ```

4. **Network**: Restrict `/api-spector/**` at your reverse proxy or firewall; use IP allowlists on the load balancer if needed.

5. **Do not expose** the built-in proxy to arbitrary target URLs in untrusted environments — it is intended for same-app localhost/dev use.

## License and third-party notices

api-spector is MIT-licensed ([LICENSE](../LICENSE)). The WebJar bundles UI dependencies and **Plus Jakarta Sans** (SIL Open Font License 1.1). See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) or `META-INF/THIRD_PARTY_NOTICES.md` inside the published JAR.

---

## Modules (advanced)

| Artifact | Use when |
|----------|----------|
| `api-spector-spring-boot-starter` | Default — UI + scanner + auto-config |
| `api-spector-scanner` | You only want OpenAPI JSON on a custom path |
| `api-spector-webjar` | You host the static UI yourself |
