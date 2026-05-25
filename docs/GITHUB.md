# Publishing on GitHub

This project is set up to distribute via **GitHub + JitPack** (no Maven Central required).

---

## What users need

After you tag a release, consumers add JitPack and depend on:

```xml
<repository>
  <id>jitpack.io</id>
  <url>https://jitpack.io</url>
</repository>

<dependency>
  <groupId>com.github.Bonker009.list-endpoints</groupId>
  <artifactId>api-spector-spring-boot-starter</artifactId>
  <version>v0.1.0</version>
</dependency>
```

See the [README](../README.md) for Gradle and fallback coordinates.

---

## Release checklist

### 1. Version bump (when needed)

Update `0.1.0` in:

- `maven/pom.xml` (parent + `<scm><tag>`)
- Child module parent versions if not inherited
- README / CONSUMER examples

### 2. Legal / notices

```bash
npm run licenses:report --prefix apps/api-spector-spa
```

Commit `licenses/npm-production.csv` if it changed.

### 3. Build & test

```bash
npm ci --prefix apps/api-spector-spa
npm run build --prefix apps/api-spector-spa
mvn -f maven/pom.xml clean verify
```

### 4. Tag and push

```bash
git add .
git commit -m "Release v0.1.0"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

### 5. GitHub Release

On https://github.com/Bonker009/list-endpoints/releases:

- **Create a new release** from tag `v0.1.0`
- Title: `v0.1.0`
- Describe changes (features, fixes, breaking changes)

Optional: attach `api-spector-spring-boot-starter-0.1.0.jar` from  
`maven/api-spector-spring-boot-starter/target/` for users who prefer manual download.

### 6. Verify JitPack

1. Open https://jitpack.io/#Bonker009/list-endpoints
2. Enter tag `v0.1.0` → **Get it**
3. Wait for green build log
4. Use the dependency snippet JitPack shows (module `api-spector-spring-boot-starter`)

`jitpack.yml` in the repo root runs:

- `npm ci && npm run build` in the SPA
- `mvn install` for scanner, webjar, and starter (skips `sample-consumer`)

---

## Install locally (no JitPack)

For development or private use:

```bash
mvn -f maven/pom.xml clean install -DskipTests
```

Coordinates: `io.github.bonker009:api-spector-spring-boot-starter:0.1.0`

---

## GitHub Packages (alternative)

If you prefer artifacts on `maven.pkg.github.com` instead of JitPack, add `distributionManagement` and a workflow with `GITHUB_TOKEN`. Consumers need a GitHub PAT and an extra `<repository>` block. JitPack is simpler for public open source.

---

## Maven Central (optional)

For `search.maven.org` and a single dependency line with no JitPack repo, follow [PUBLISHING.md](PUBLISHING.md).
