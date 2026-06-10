import { tool, type ToolSet } from "ai";
import { createHash } from "crypto";
import { z } from "zod";
import { chunksToContextBlocks } from "@/domain/ai/pipeline/context-format";
import { hashSqlPreview } from "@/domain/db/sanitize-sql";
import { DbRetriever } from "@/infrastructure/ai/rag/db-retriever";
import { OpenApiRetriever } from "@/infrastructure/ai/rag/openapi-retriever";
import {
  executeAgentReadOnlyQuery,
  type UserDbConnectionRow,
} from "@/infrastructure/db/postgres-user-client";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";
import { postgresDbRagRepository } from "@/infrastructure/repositories/postgres-db-rag-repository";
import type { DbSchemaSnapshot } from "@/domain/db/types";

export type UnifiedToolContext = {
  specId: string;
  retrievalQuery: string;
  connectionRow?: UserDbConnectionRow;
  connectionId?: string;
};

export type UnifiedToolName =
  | "search_api_docs"
  | "list_api_endpoints"
  | "search_db_schema"
  | "list_db_tables"
  | "get_table_schema"
  | "execute_readonly_sql";

const openApiRetriever = new OpenApiRetriever();
const dbRetriever = new DbRetriever();

function parseSchema(snapshot: unknown): DbSchemaSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const tables = (snapshot as DbSchemaSnapshot).tables;
  if (!Array.isArray(tables)) return null;
  return snapshot as DbSchemaSnapshot;
}

export function createUnifiedAssistantTools(ctx: UnifiedToolContext) {
  const search_api_docs = tool({
    description:
      "Semantic search over indexed OpenAPI documentation chunks for this spec.",
    inputSchema: z.object({
      query: z.string().optional().describe("Override search query"),
    }),
    execute: async ({ query }) => {
      const q = query?.trim() || ctx.retrievalQuery;
      const chunks = await openApiRetriever.retrieve({
        specId: ctx.specId,
        query: q,
        limit: 8,
      });
      if (!chunks.length) return "No matching API documentation chunks.";
      return chunksToContextBlocks(chunks).join("\n\n---\n\n");
    },
  });

  const list_api_endpoints = tool({
    description: "List all endpoints (METHOD /path) in this spec.",
    inputSchema: z.object({}),
    execute: async () => {
      const eps = await openApiRetriever.listAllowedEndpoints(ctx.specId);
      if (!eps.length) return "No endpoints indexed.";
      return eps.map((e) => `- ${e}`).join("\n");
    },
  });

  if (!ctx.connectionRow || !ctx.connectionId) {
    return { search_api_docs, list_api_endpoints } as ToolSet;
  }

  const row = ctx.connectionRow;
  const connectionId = ctx.connectionId;

  const search_db_schema = tool({
    description: "Semantic search over indexed database schema chunks.",
    inputSchema: z.object({
      query: z.string().optional().describe("Override search query"),
    }),
    execute: async ({ query }) => {
      const q = query?.trim() || ctx.retrievalQuery;
      const chunks = await dbRetriever.retrieve({
        connectionId,
        query: q,
        limit: 8,
      });
      if (!chunks.length) {
        return "No matching DB schema chunks. Run Index schema first.";
      }
      return chunksToContextBlocks(chunks).join("\n\n---\n\n");
    },
  });

  const list_db_tables = tool({
    description: "List table names from the cached schema snapshot.",
    inputSchema: z.object({}),
    execute: async () => {
      const snap = await postgresDbConnectionRepository.getLatestSchema(
        connectionId
      );
      const schema = parseSchema(snap?.schemaJson);
      if (!schema?.tables.length) {
        return "No schema snapshot. Run introspect/index first.";
      }
      return schema.tables.map((t) => `${t.schema}.${t.name}`).join(", ");
    },
  });

  const get_table_schema = tool({
    description: "Get columns, primary keys, and foreign keys for one table.",
    inputSchema: z.object({
      table: z.string().describe("Table name"),
      schema: z.string().optional().describe("Schema name, default public"),
    }),
    execute: async ({ table, schema: schemaName }) => {
      const snap = await postgresDbConnectionRepository.getLatestSchema(
        connectionId
      );
      const schema = parseSchema(snap?.schemaJson);
      const sch = schemaName?.trim() || "public";
      const t = schema?.tables.find(
        (x) =>
          x.name.toLowerCase() === table.toLowerCase() &&
          x.schema.toLowerCase() === sch.toLowerCase()
      );
      if (!t) return `Table not found: ${sch}.${table}`;
      return JSON.stringify(t, null, 2);
    },
  });

  const execute_readonly_sql = tool({
    description:
      "Execute a read-only PostgreSQL SELECT. No forced small LIMIT; results may be byte-truncated.",
    inputSchema: z.object({
      query: z.string().describe("Single PostgreSQL SELECT query"),
    }),
    execute: async ({ query }) => {
      const started = Date.now();
      const sqlHash = createHash("sha256")
        .update(query)
        .digest("hex")
        .slice(0, 16);
      try {
        const result = await executeAgentReadOnlyQuery(row, query);
        await postgresDbRagRepository.recordQueryAudit({
          connectionId,
          sqlHash,
          sqlPreview: hashSqlPreview(result.sql),
          rowCount: result.rowCount,
          durationMs: Date.now() - started,
          success: true,
          source: "agent",
        });
        return JSON.stringify(
          {
            sql: result.sql,
            rows: result.rows,
            rowCount: result.rowCount,
            truncated: result.truncated ?? false,
            totalFetched: result.totalFetched,
            note: result.note,
          },
          null,
          2
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await postgresDbRagRepository.recordQueryAudit({
          connectionId,
          sqlHash,
          sqlPreview: hashSqlPreview(query),
          durationMs: Date.now() - started,
          success: false,
          errorMessage: msg.slice(0, 500),
          source: "agent",
        });
        return JSON.stringify({ error: msg, failedSql: query });
      }
    },
  });

  return {
    search_api_docs,
    list_api_endpoints,
    search_db_schema,
    list_db_tables,
    get_table_schema,
    execute_readonly_sql,
  } as ToolSet;
}

export function toolNameToStatusPhase(
  toolName: string
): "searching-api" | "searching-db" | "running-sql" | "generating" {
  if (toolName === "search_api_docs" || toolName === "list_api_endpoints") {
    return "searching-api";
  }
  if (
    toolName === "search_db_schema" ||
    toolName === "list_db_tables" ||
    toolName === "get_table_schema"
  ) {
    return "searching-db";
  }
  if (toolName === "execute_readonly_sql") return "running-sql";
  return "generating";
}
