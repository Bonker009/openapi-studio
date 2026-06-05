import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute, readDbJsonBody } from "@/lib/db/route-helpers";
import { dbConnectionService } from "@/features/db/db-connection-service";
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
    const row = await dbConnectionService.get(specId, connectionId);
    const limit = dbFillPageSize();
    const offset = Math.max(0, Number(body.offset ?? 0));
    const sql = `SELECT "${column}" AS value FROM "${schema}"."${table}" WHERE "${column}" IS NOT NULL ORDER BY 1 LIMIT ${limit} OFFSET ${offset}`;
    const result = await executeReadOnlyQuery(row, sql, {
      allowedTables: [table],
    });
    const values = result.rows
      .map((r) => r.value)
      .filter((v) => v != null)
      .map(String);
    return NextResponse.json({ values, limit, offset });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load values";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
