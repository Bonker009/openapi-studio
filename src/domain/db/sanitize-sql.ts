import { Parser } from "node-sql-parser";

const DENY_RE =
  /\b(insert|update|delete|drop|truncate|alter|create|replace|copy|grant|revoke|call|execute|merge|into\s+outfile)\b/i;

const HAS_LIMIT_TAIL_RE = /\blimit\s+\d+(\s*,\s*\d+)?\s*;?\s*$/i;

const parser = new Parser();

export type SanitizeSqlOptions = {
  maxRows?: number;
  allowedTables?: string[];
  /** When false, do not append LIMIT if the query has none (agent chat path). */
  injectLimit?: boolean;
};

export function sanitizeReadOnlySql(
  raw: string,
  options: SanitizeSqlOptions = {}
): string {
  const maxRows = options.maxRows ?? 20;
  let query = String(raw ?? "").trim();
  if (!query) throw new Error("Empty SQL query");

  const semis = [...query].filter((c) => c === ";").length;
  if (semis > 1 || (query.endsWith(";") && query.slice(0, -1).includes(";"))) {
    throw new Error("Multiple SQL statements are not allowed");
  }
  query = query.replace(/;+\s*$/g, "").trim();

  const lower = query.toLowerCase();
  if (!lower.startsWith("select") && !lower.startsWith("with")) {
    throw new Error("Only SELECT / WITH queries are allowed");
  }
  if (DENY_RE.test(query)) {
    throw new Error("DML/DDL detected. Only read-only queries are permitted");
  }

  let ast: unknown;
  try {
    ast = parser.astify(query, { database: "PostgreSQL" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid SQL";
    throw new Error(`SQL parse error: ${msg}`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    throw new Error("Only a single SQL statement is allowed");
  }
  const stmt = statements[0] as { type?: string };
  if (stmt.type !== "select") {
    throw new Error("Only SELECT statements are allowed (AST)");
  }

  if (options.allowedTables?.length) {
    const tables = parser.tableList(query, { database: "PostgreSQL" });
    for (const entry of tables) {
      const parts = entry.split("::");
      const table = (parts[2] ?? parts[1] ?? "").toLowerCase();
      if (
        table &&
        !options.allowedTables.some((t) => t.toLowerCase() === table)
      ) {
        throw new Error(`Table not allowed: ${table}`);
      }
    }
  }

  const injectLimit = options.injectLimit !== false;
  if (injectLimit && !HAS_LIMIT_TAIL_RE.test(query)) {
    query += ` LIMIT ${maxRows}`;
  }

  return query;
}

export function hashSqlPreview(sql: string, maxLen = 500): string {
  return sql.length <= maxLen ? sql : `${sql.slice(0, maxLen)}…`;
}
