# Publish with GitHub Packages (Apache Maven)

Artifacts are published to:

**`https://maven.pkg.github.com/Bonker009/list-endpoints`**

Coordinates stay **`io.github.bonker009`** (no JitPack).

---

## One-time: enable Packages on the repo

1. Push this repo to GitHub (`Bonker009/list-endpoints`).
2. After the first publish, open **GitHub → your profile → Packages** (or the repo **Packages** tab).
3. Open package **`api-spector-spring-boot-starter`** → **Package settings** → set visibility to **Public** if you want anyone to download without repo access.

---

## Publish from branch `maven/gradle` (step by step)

### 1. Commit and push your branch

```bash
cd path/to/list-endpoints
git checkout maven/gradle

git add .
git status
git commit -m "Prepare v0.1.0 for GitHub Packages"
git push origin maven/gradle
```

### 2. Tag the release (on this branch)

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag must point to the commit you want to release (usually the latest on `maven/gradle`).

### 3. GitHub Actions publishes the JARs

Pushing tag `v0.1.0` runs [`.github/workflows/publish-github-packages.yml`](../.github/workflows/publish-github-packages.yml):

- Builds the SPA
- Runs `mvn deploy` to GitHub Packages (scanner, webjar, starter)

Check: **Actions** tab → **Publish to GitHub Packages** → green check.

### 4. Create a GitHub Release (optional but recommended)

1. https://github.com/Bonker009/list-endpoints/releases  
2. **Draft a new release** → tag **`v0.1.0`**  
3. Add release notes → **Publish release**

### 5. Publish manually (without Actions)

From repo root, with a PAT in `~/.m2/settings.xml` (see [settings-github-packages.xml.example](../maven/settings-github-packages.xml.example)):

```bash
npm ci --prefix apps/api-spector-spa
npm run build --prefix apps/api-spector-spa

mvn -f maven/pom.xml -Pgithub-publish deploy \
  -pl api-spector-scanner,api-spector-webjar,api-spector-spring-boot-starter \
  -am
```

Server **`id`** must be **`github`** (matches `distributionManagement` in `maven/pom.xml`).

---

## What consumers add

GitHub Packages uses the **same `github` server id** in Maven settings (PAT with `read:packages`).

**`~/.m2/settings.xml`**

```xml
<settings>
  <servers>
    <server>
      <id>github</id>
      <username>YOUR_GITHUB_USERNAME</username>
      <password>YOUR_GITHUB_PAT</password>
    </server>
  </servers>
</settings>
```

**`pom.xml`**

```xml
<repositories>
  <repository>
    <id>github</id>
    <url>https://maven.pkg.github.com/Bonker009/list-endpoints</url>
  </repository>
</repositories>

<dependency>
  <groupId>io.github.bonker009</groupId>
  <artifactId>api-spector-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

**Gradle (Kotlin DSL)** — add PAT via `gradle.properties` or env; see [GitHub docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-apache-maven-registry).

---

## Legal / notices before publish

```bash
npm run licenses:report --prefix apps/api-spector-spa
```

See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

---

## Maven Central (optional, no GitHub repo block)

For `search.maven.org` only, follow [PUBLISHING.md](PUBLISHING.md) instead of GitHub Packages.
