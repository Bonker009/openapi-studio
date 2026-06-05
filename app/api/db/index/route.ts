import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute, readDbJsonBody } from "@/lib/db/route-helpers";
import { dbIndexService } from "@/features/db/db-index-service";
import { validateSpecId } from "@/lib/spec-id";

export async function POST(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const body = await readDbJsonBody<{ specId?: string; connectionId?: string }>(
    request
  );
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  const connectionId = body.connectionId?.trim();
  if (!specId || !connectionId) {
    return NextResponse.json(
      { error: "specId and connectionId are required" },
      { status: 400 }
    );
  }

  try {
    validateSpecId(specId);
    const result = await dbIndexService.indexConnection(specId, connectionId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Indexing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
