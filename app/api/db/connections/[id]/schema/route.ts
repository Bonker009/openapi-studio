import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute } from "@/lib/db/route-helpers";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";
import type { DbSchemaSnapshot } from "@/domain/db/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const { id } = await context.params;
  const specId = request.nextUrl.searchParams.get("specId")?.trim();
  if (!specId) {
    return NextResponse.json({ error: "specId is required" }, { status: 400 });
  }

  try {
    const row = await postgresDbConnectionRepository.findForSpec(specId, id);
    if (!row) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    const snap = await postgresDbConnectionRepository.getLatestSchema(id);
    if (!snap?.schemaJson) {
      return NextResponse.json(
        { error: "No schema snapshot. Run Index schema first." },
        { status: 404 }
      );
    }
    const schema = snap.schemaJson as DbSchemaSnapshot;
    return NextResponse.json({
      schema,
      introspectedAt: schema.introspectedAt,
      tableCount: schema.tables?.length ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load schema";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
