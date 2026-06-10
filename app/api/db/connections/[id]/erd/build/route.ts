import { type NextRequest, NextResponse } from "next/server";
import { liamErdEnabled } from "@/domain/db/config";
import { isValidConnectionId } from "@/domain/db/erd-security";
import { ensureErdBuild } from "@/features/db/liam-erd-service";
import { guardDbRoute } from "@/lib/db/route-helpers";
import { validateSpecId } from "@/lib/spec-id";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  if (!liamErdEnabled()) {
    return NextResponse.json(
      { error: "Liam ERD is disabled" },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const specId = request.nextUrl.searchParams.get("specId")?.trim();
  if (!specId) {
    return NextResponse.json({ error: "specId is required" }, { status: 400 });
  }
  try {
    validateSpecId(specId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid specId";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!isValidConnectionId(id)) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const force =
    request.nextUrl.searchParams.get("force") === "1" ||
    request.nextUrl.searchParams.get("force") === "true";

  try {
    const result = await ensureErdBuild({
      specId,
      connectionId: id,
      force,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ERD build failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("No schema snapshot")
        ? 412
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
