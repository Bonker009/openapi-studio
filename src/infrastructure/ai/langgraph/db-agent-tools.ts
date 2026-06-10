import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createHash } from "crypto";
import { DbRetriever } from "@/infrastructure/ai/rag/db-retriever";
import { OpenApiRetriever } from "@/infrastructure/ai/rag/openapi-retriever";
import { chunksToContextBlocks } from "@/domain/ai/pipeline/context-format";
import {
  executeAgentReadOnlyQuery,
  type UserDbConnectionRow,
} from "@/infrastructure/db/postgres-user-client";
import { hashSqlPreview } from "@/domain/db/sanitize-sql";
import { postgresDbRagRepository } from "@/infrastructure/repositories/postgres-db-rag-repository";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";

export function createDbAgentTools(input: {
  specId: string;
  connectionRow: UserDbConnectionRow;
  retrievalQuery: string;
}) {
  const dbRetriever = new DbRetriever();
  const openApiRetriever = new OpenApiRetriever();

  const retrieveContext = tool(
    async () => {
      const [dbChunks, apiChunks] = await Promise.all([
        dbRetriever.retrieve({
          connectionId: input.connectionRow.id,
          query: input.retrievalQuery,
          limit: 6,
        }),
        openApiRetriever.retrieve({
          specId: input.specId,
          query: input.retrievalQuery,
          limit: 4,
        }),
      ]);
      const blocks = chunksToContextBlocks([...dbChunks, ...apiChunks]);
      if (blocks.length === 0) {
        return "No indexed context. Index OpenAPI and database schema first.";
      }
      return blocks.join("\n\n---\n\n");
    },
    {
      name: "retrieve_context",
      description:
        "Retrieve ranked schema/documentation context for this spec and database. Call first before writing SQL.",
      schema: z.object({}),
    }
  );

  const listTables = tool(
    async () => {
      const snap = await postgresDbConnectionRepository.getLatestSchema(
        input.connectionRow.id
      );
      if (!snap?.schemaJson) {
        return "No schema snapshot. Run introspect/index first.";
      }
      const tables = (snap.schemaJson as { tables?: { name: string }[] })
        .tables;
      return (tables ?? []).map((t) => t.name).join(", ") || "(no tables)";
    },
    {
      name: "list_tables",
      description: "List table names from the cached schema snapshot.",
      schema: z.object({}),
    }
  );

  const executeSql = tool(
    async ({ query }: { query: string }) => {
      const started = Date.now();
      const sqlHash = createHash("sha256").update(query).digest("hex").slice(0, 16);
      try {
        const result = await executeAgentReadOnlyQuery(
          input.connectionRow,
          query
        );
        await postgresDbRagRepository.recordQueryAudit({
          connectionId: input.connectionRow.id,
          sqlHash,
          sqlPreview: hashSqlPreview(result.sql),
          rowCount: result.rowCount,
          durationMs: Date.now() - started,
          success: true,
          source: "agent",
        });
        return JSON.stringify(
          { sql: result.sql, rows: result.rows, rowCount: result.rowCount },
          null,
          2
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await postgresDbRagRepository.recordQueryAudit({
          connectionId: input.connectionRow.id,
          sqlHash,
          sqlPreview: hashSqlPreview(query),
          durationMs: Date.now() - started,
          success: false,
          errorMessage: msg.slice(0, 500),
          source: "agent",
        });
        return JSON.stringify({
          error: msg,
          failedSql: query,
          hint: "Fix PostgreSQL syntax or table/column names and retry.",
        });
      }
    },
    {
      name: "execute_readonly_sql",
      description:
        "Execute a read-only PostgreSQL SELECT. Results are truncated. On error, read the message and submit a corrected query.",
      schema: z.object({
        query: z.string().describe("Single PostgreSQL SELECT query"),
      }),
    }
  );

  return [retrieveContext, listTables, executeSql];
}

export const DB_AGENT_SYSTEM_PROMPT = `You are a PostgreSQL-aware API testing assistant.
- Use retrieve_context and list_tables before guessing schema.
- Only PostgreSQL syntax. Use double-quoted identifiers when needed.
- Only read-only SELECT queries via execute_readonly_sql. No forced small LIMIT; results may be truncated by server byte cap.
- Ground answers in tool results and retrieved context. Say when unsure.
- Never ask for or reveal database passwords.`;
