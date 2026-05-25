# api-spector

Interactive API playground for Spring Boot 3.x. Add one dependency, run your app, open **`/api-spector`**, and explore every `@RestController` endpoint with try-it requests, smoke tests, Excel/OpenAPI export, and OpenAPI 3.1 schemas from your Jackson DTOs.

No database. No springdoc. No Swagger annotations required.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Install from GitHub (JitPack)

Add the JitPack repository and depend on the **starter** module (replace `VERSION` with a [GitHub release tag](https://github.com/Bonker009/list-endpoints/tags), e.g. `v0.1.0`):

**Maven**

```xml
<repositories>
  <repository>
    <id>jitpack.io</id>
    <url>https://jitpack.io</url>
  </repository>
</repositories>

<dependency>
  <groupId>com.github.Bonker009.list-endpoints</groupId>
  <artifactId>api-spector-spring-boot-starter</artifactId>
  <version>VERSION</version>
</dependency>
```

After tagging, confirm the build at [jitpack.io/#Bonker009/list-endpoints](https://jitpack.io/#Bonker009/list-endpoints) and use the snippet JitPack prints for that tag.

**Gradle (Kotlin DSL)**

```kotlin
repositories {
    mavenCentral()
    maven("https://jitpack.io")
}

dependencies {
    implementation("com.github.Bonker009.list-endpoints:api-spector-spring-boot-starter:VERSION")
}
```

**Gradle (Groovy)**

```groovy
repositories {
    mavenCentral()
    maven { url 'https://jitpack.io' }
}

dependencies {
    implementation 'com.github.Bonker009.list-endpoints:api-spector-spring-boot-starter:VERSION'
}
```

---

## Install from source (local Maven)

Clone this repo and install the libraries into your local `~/.m2` repository:

```bash
git clone https://github.com/Bonker009/list-endpoints.git
cd list-endpoints

npm ci --prefix apps/api-spector-spa
npm run build --prefix apps/api-spector-spa

mvn -f maven/pom.xml clean install -DskipTests
```

Then use the published coordinates (no extra repository):

```xml
<dependency>
  <groupId>io.github.bonker009</groupId>
  <artifactId>api-spector-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

---

## Quick start

1. Add the dependency (JitPack or local install).
2. Run your Spring Boot 3.x application.
3. Open **`http://localhost:8080/api-spector`**.

On startup you should see logs like:

```text
api-spector playground: http://localhost:8080/api-spector
api-spector OpenAPI:   http://localhost:8080/api-spector/api-docs
api-spector proxy:     http://localhost:8080/api-spector/proxy
```

| URL | Description |
|-----|-------------|
| `/api-spector` | Playground UI |
| `/api-spector/api-docs` | OpenAPI 3.1 JSON (scanned from your controllers) |
| `/api-spector/proxy` | Built-in try-it proxy |

Try the sample app in this repo:

```bash
mvn -f maven/sample-consumer spring-boot:run
```

---

## Configuration

```yaml
apispector:
  enabled: true                    # false to disable; auto-off on prod profile if unset
  production-profiles: prod,production
  path: /api-spector
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

Full reference: [docs/CONSUMER.md](docs/CONSUMER.md)

---

## Features

- OpenAPI 3.1 from Spring MVC mappings + Jackson DTOs ([victools](https://github.com/victools/jsonschema-generator))
- Try-it panel with built-in same-origin proxy
- Smoke tests, Excel / OpenAPI / Postman export
- Production gate: auto-disable on `prod` profile, optional HTTP Basic auth
- Deep linking, sidebar search, configurable doc expansion

---

## Repository layout

| Path | Description |
|------|-------------|
| `apps/api-spector-spa/` | Vite + React UI (WebJar source) |
| `maven/api-spector-scanner/` | Spring MVC → OpenAPI scanner |
| `maven/api-spector-webjar/` | Packages SPA into the WebJar |
| `maven/api-spector-spring-boot-starter/` | Spring Boot auto-configuration |
| `maven/sample-consumer/` | Example app + integration tests |

---

## Build & test

Requires **Node.js 22+** and **Java 17+**.

```bash
npm ci --prefix apps/api-spector-spa
npm run build --prefix apps/api-spector-spa
mvn -f maven/pom.xml clean verify
```

---

## Releases on GitHub

1. Ensure [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) is up to date (`npm run licenses:report --prefix apps/api-spector-spa` if npm deps changed).
2. Tag a version: `git tag v0.1.0 && git push origin v0.1.0`
3. Create a **GitHub Release** from that tag with release notes.
4. JitPack will build `com.github.Bonker009.list-endpoints:…:v0.1.0` — check https://jitpack.io/#Bonker009/list-endpoints

Maintainer notes: [docs/GITHUB.md](docs/GITHUB.md)  
Maven Central (optional): [docs/PUBLISHING.md](docs/PUBLISHING.md)

---

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

---

## License

**MIT** — see [LICENSE](LICENSE).

Bundled UI font and npm dependencies: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (also shipped under `META-INF/` in published JARs).
