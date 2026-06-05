# Database Connection Terms (v1)

By connecting a PostgreSQL database to this application, you agree:

1. **Read-only access** — The integration only permits `SELECT` / schema introspection. Do not grant write privileges to the credentials you provide.

2. **Server-side processing** — Connection details are stored encrypted on the application server. Schema metadata and small samples may be sent to your configured AI provider to answer questions. Passwords are not sent to the AI.

3. **Your responsibility** — Use a dedicated read-only database user with access limited to required tables. Revoke connections when no longer needed.

4. **API keys** — Playground Bearer tokens and outbound API keys are separate from database credentials. Handle both with care.

5. **Retention** — Connection metadata, audit logs, and indexed schema chunks are stored until you delete the connection.

To revoke: delete the connection in the Database tab or via `DELETE /api/db/connections/{id}?specId=...`.
