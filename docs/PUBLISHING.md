# Publishing to Maven Central

Artifacts are published under **`io.github.bonker009`** (matches GitHub user [Bonker009](https://github.com/Bonker009)).

Published modules:

| Artifact | Description |
|----------|-------------|
| `api-spector-scanner` | Spring MVC → OpenAPI scanner |
| `api-spector-webjar` | SPA WebJar |
| `api-spector-spring-boot-starter` | Spring Boot auto-configuration (what apps depend on) |

`sample-consumer` is **not** published.

---

## One-time setup

### 1. Create a Sonatype Central account

1. Sign in at [central.sonatype.com](https://central.sonatype.com) with your GitHub account.
2. Open **Namespaces** → **Register namespace**.
3. Enter **`io.github.bonker009`**.
4. Complete verification (Sonatype will ask you to prove control of the GitHub user `Bonker009` — usually a public repo, `pom.xml` check, or a temporary gist).

Wait until the namespace shows as **approved** before deploying.

### 2. Generate a user token

In Central Portal: **Account** → **Generate User Token**.

Save:

- **Username** (token username, often your email or a generated id)
- **Password** (the token secret — shown once)

### 3. Create a GPG key

Maven Central requires signed artifacts.

```bash
gpg --full-generate-key
# RSA, 4096 bits, name/email you use on Central

gpg --list-secret-keys --keyid-format long
gpg --keyserver keyserver.ubuntu.com --send-keys YOUR_KEY_ID
```

Export for CI (optional):

```bash
gpg --armor --export-secret-keys YOUR_KEY_ID > secring.asc
```

### 4. Local `~/.m2/settings.xml`

```xml
<settings>
  <servers>
    <server>
      <id>central</id>
      <username>YOUR_CENTRAL_TOKEN_USERNAME</username>
      <password>YOUR_CENTRAL_TOKEN_PASSWORD</password>
    </server>
  </servers>
  <profiles>
    <profile>
      <id>release</id>
      <properties>
        <gpg.keyname>YOUR_KEY_ID</gpg.keyname>
      </properties>
    </profile>
  </profiles>
</settings>
```

---

## Release from your machine

### 1. Bump version (when needed)

Edit `maven/pom.xml` and child parents, e.g. `0.1.0` → `0.1.1`, and update `<scm><tag>v0.1.1</tag></scm>`.

### 2. Build UI + verify

From repo root:

```bash
npm ci --prefix apps/api-spector-spa
npm run build --prefix apps/api-spector-spa
mvn -f maven/pom.xml clean verify
```

### 3. Deploy to Central (staging)

```bash
mvn -f maven/pom.xml -Prelease deploy \
  -pl api-spector-scanner,api-spector-webjar,api-spector-spring-boot-starter \
  -am
```

This attaches **sources**, **javadoc**, **GPG signatures**, and uploads a bundle to Central Portal.

### 4. Publish in the portal

With `autoPublish=false` (default in this repo):

1. Open [central.sonatype.com](https://central.sonatype.com) → **Deployments**.
2. Find the new deployment for `io.github.bonker009`.
3. Wait until status is **Validated**, then click **Publish**.

After sync (often 15–30 minutes, sometimes longer), artifacts appear on [search.maven.org](https://search.maven.org/).

### 5. Git tag

```bash
git tag v0.1.0
git push origin v0.1.0
```

Create a GitHub Release from the tag with release notes.

---

## Release via GitHub Actions

Workflow: `.github/workflows/publish-central.yml` (runs on `v*` tags).

Repository secrets:

| Secret | Value |
|--------|--------|
| `CENTRAL_USERNAME` | Central user token username |
| `CENTRAL_PASSWORD` | Central user token password |
| `GPG_PRIVATE_KEY` | ASCII-armored private key |
| `GPG_PASSPHRASE` | Key passphrase (empty string if none) |

Push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow builds the SPA, runs `mvn deploy -Prelease`, and uploads to Central. You still **publish** the deployment in the portal unless you set `autoPublish=true` in the release profile.

---

## Legal / notices before you publish

- Root [LICENSE](../LICENSE) (MIT) covers your code.
- [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and [licenses/](../licenses/) document bundled font (OFL) and npm/Java deps.
- `mvn package` copies these into `META-INF/` in **webjar** and **starter** JARs automatically.

Regenerate npm CSV if you changed SPA dependencies:

```bash
npm run licenses:report --prefix apps/api-spector-spa
```

---

## Consumer dependency (after publish)

```xml
<dependency>
  <groupId>io.github.bonker009</groupId>
  <artifactId>api-spector-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

No extra `<repository>` block is required once artifacts are on Maven Central.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Namespace rejected | Use `io.github.bonker009`, not `io.github.apispector`, unless you own the `apispector` GitHub org |
| GPG sign failed | `gpg.keyname` in settings; on Windows use Gpg4win and `gpg.exe` on PATH |
| WebJar empty | Run `npm run build` in `apps/api-spector-spa` before `deploy` |
| 401 on deploy | Regenerate Central token; check `server` id is exactly `central` |
| Javadoc errors | Release profile sets `failOnError=false`; fix public API docs over time |
