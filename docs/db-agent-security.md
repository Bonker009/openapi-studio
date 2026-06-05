# Database Agent — Dependency Security

## Allowed packages (v1)

| Package | Purpose | License |
|---------|---------|---------|
| `@langchain/langgraph` | Agent orchestration | MIT |
| `@langchain/core` | Tools, messages | MIT |
| `@langchain/classic` | SQL database helpers (minimal import surface) | MIT |
| `@langchain/openai` / `@langchain/groq` | Chat models for agent loop | MIT |
| `@langchain/langgraph-checkpoint-postgres` | Conversation memory on app Postgres | MIT |
| `node-sql-parser` | AST validation for read-only SQL | GPL-2.0 (used server-side only) |
| `pg-connection-string` | URI parsing | MIT |
| `typeorm` | Peer of `@langchain/classic/sql_db` (transitive) | MIT |

## Audit cadence

1. Run `npm audit` before adding or upgrading LangChain packages.
2. Fail CI on new **high** or **critical** vulnerabilities in production dependencies.
3. Pin major versions in `package-lock.json`; use `npm ci` in Docker builds.
4. Review `npm ls typeorm` after upgrades — we do not use TypeORM directly except via LangChain `SqlDatabase` optional paths; primary introspection uses `pg` + `information_schema`.

## Supply-chain checklist

- [ ] No unexpected `postinstall` scripts in new deps
- [ ] `DB_CREDENTIALS_ENCRYPTION_KEY` set in production (32+ byte secret)
- [ ] `DB_CONNECT_ALLOWED_HOSTS` set when exposing the app publicly
- [ ] LangSmith / debug logging disabled from printing SQL passwords

## Incident response

1. Revoke affected database user passwords at the source DB.
2. Delete stored connections via API or UI.
3. Rotate `DB_CREDENTIALS_ENCRYPTION_KEY` only with a migration plan (existing blobs become unreadable).
4. Upgrade patched npm packages and redeploy.

## Last audit note

Document `npm audit` results when implementing/upgrading. As of initial integration, moderate issues may exist in transitive dev tooling — track production dependency tree separately.
