import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute } from "@/lib/db/route-helpers";
import { dbConnectionService } from "@/features/db/db-connection-service";

export async function DELETE(
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
    await dbConnectionService.remove(specId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
