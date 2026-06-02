import { type NextRequest, NextResponse } from "next/server";
import { aiFlowService } from "@/features/ai/ai-flow-service";
import { guardAiRoute, readAiJsonBody } from "@/lib/ai/route-helpers";
import { validateSpecId } from "@/lib/spec-id";

export async function POST(request: NextRequest) {
  const denied = guardAiRoute(request);
  if (denied) return denied;

  const body = await readAiJsonBody<{
    specId?: string;
    userIntent?: string;
    baseUrl?: string;
    conversationId?: string;
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

  try {
    const result = await aiFlowService.generateFlow({
      specId,
      userIntent: body.userIntent,
      baseUrl: body.baseUrl,
      conversationId: body.conversationId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/ai/flow:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("not indexed") ? 412 : message.includes("validation") ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
