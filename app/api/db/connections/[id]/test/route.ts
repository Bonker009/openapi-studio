import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute } from "@/lib/db/route-helpers";
import { dbConnectionService } from "@/features/db/db-connection-service";

export async function POST(
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
    const result = await dbConnectionService.test(specId, id);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection test failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
