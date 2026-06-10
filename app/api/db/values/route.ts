import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute, readDbJsonBody } from "@/lib/db/route-helpers";
import { dbConnectionService } from "@/features/db/db-connection-service";
import { loadValidatedTable } from "@/features/db/db-schema-guard";
import { executeReadOnlyQuery } from "@/infrastructure/db/postgres-user-client";
import { dbFillPageSize } from "@/domain/db/config";
import { validateSpecId } from "@/lib/spec-id";

export async function POST(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const body = await readDbJsonBody<{
    specId?: string;
    connectionId?: string;
    table?: string;
    column?: string;
    schema?: string;
    offset?: number;
    search?: string;
  }>(request);
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  const connectionId = body.connectionId?.trim();
  const table = body.table?.trim();
  const column = body.column?.trim();
  const schema = body.schema?.trim() || "public";

  if (!specId || !connectionId || !table || !column) {
    return NextResponse.json(
      { error: "specId, connectionId, table, and column are required" },
      { status: 400 }
    );
  }

  try {
    validateSpecId(specId);
    await loadValidatedTable(connectionId, table, schema, column);
    const row = await dbConnectionService.get(specId, connectionId);
    const limit = dbFillPageSize();
    const offset = Math.max(0, Number(body.offset ?? 0));
    const search = body.search?.trim();

    const whereParts = [`"${column}" IS NOT NULL`];
    if (search) {
      const escaped = search.replace(/'/g, "''");
      whereParts.push(`"${column}"::text ILIKE '%${escaped}%'`);
    }
    const where = whereParts.join(" AND ");

    const countSql = `SELECT COUNT(*)::int AS total FROM "${schema}"."${table}" WHERE ${where}`;
    const dataSql = `SELECT "${column}" AS value FROM "${schema}"."${table}" WHERE ${where} ORDER BY 1 LIMIT ${limit} OFFSET ${offset}`;

    const countResult = await executeReadOnlyQuery(row, countSql, {
      allowedTables: [table],
      maxRows: 1,
    });
    const total = Number(countResult.rows[0]?.total ?? 0);

    const result = await executeReadOnlyQuery(row, dataSql, {
      allowedTables: [table],
      maxRows: limit,
    });
    const values = result.rows
      .map((r) => r.value)
      .filter((v) => v != null)
      .map(String);
    return NextResponse.json({ values, total, limit, offset });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load values";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
