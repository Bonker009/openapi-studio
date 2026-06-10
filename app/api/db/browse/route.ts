import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute, readDbJsonBody } from "@/lib/db/route-helpers";
import { dbConnectionService } from "@/features/db/db-connection-service";
import { browseTable } from "@/features/db/db-browse-service";
import { validateSpecId } from "@/lib/spec-id";

export async function POST(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const body = await readDbJsonBody<{
    specId?: string;
    connectionId?: string;
    table?: string;
    schema?: string;
    page?: number;
    pageSize?: number;
    sortColumn?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    searchColumn?: string;
  }>(request);
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  const connectionId = body.connectionId?.trim();
  const table = body.table?.trim();
  if (!specId || !connectionId || !table) {
    return NextResponse.json(
      { error: "specId, connectionId, and table are required" },
      { status: 400 }
    );
  }

  try {
    validateSpecId(specId);
    const row = await dbConnectionService.get(specId, connectionId);
    const result = await browseTable({
      connectionRow: row,
      table,
      schema: body.schema,
      page: body.page,
      pageSize: body.pageSize,
      sortColumn: body.sortColumn,
      sortDir: body.sortDir,
      search: body.search,
      searchColumn: body.searchColumn,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Browse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
