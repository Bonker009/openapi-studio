import { type NextRequest, NextResponse } from "next/server";
import { aiFlowService } from "@/features/ai/ai-flow-service";
import { getEmbeddingDisabledReason } from "@/lib/ai/module-status";
import { guardAiRoute, readAiJsonBody } from "@/lib/ai/route-helpers";
import { validateSpecId } from "@/lib/spec-id";

export async function POST(request: NextRequest) {
  const denied = guardAiRoute(request);
  if (denied) return denied;

  const body = await readAiJsonBody<{
    specId?: string;
    force?: boolean;
  }>(request);
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  if (!specId) {
    return NextResponse.json({ error: "specId is required" }, { status: 400 });
  }
  try {
    validateSpecId(specId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid specId";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const embeddingReason = getEmbeddingDisabledReason();
  if (embeddingReason) {
    return NextResponse.json({ error: embeddingReason }, { status: 403 });
  }

  try {
    const result = await aiFlowService.indexOpenApi({
      specId,
      force: body.force,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/ai/index-openapi:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
