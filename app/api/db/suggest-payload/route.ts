import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute, readDbJsonBody } from "@/lib/db/route-helpers";
import { dbAgentService } from "@/features/db/db-agent-service";
import { validateSpecId } from "@/lib/spec-id";

export async function POST(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const body = await readDbJsonBody<{
    specId?: string;
    connectionId?: string;
    endpointKey?: string;
    paramNames?: string[];
  }>(request);
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  const connectionId = body.connectionId?.trim();
  const endpointKey = body.endpointKey?.trim();
  const paramNames = Array.isArray(body.paramNames)
    ? body.paramNames.filter((p): p is string => typeof p === "string")
    : [];

  if (!specId || !connectionId || !endpointKey || paramNames.length === 0) {
    return NextResponse.json(
      { error: "specId, connectionId, endpointKey, and paramNames are required" },
      { status: 400 }
    );
  }

  try {
    validateSpecId(specId);
    const result = await dbAgentService.suggestPayload({
      specId,
      connectionId,
      endpointKey,
      paramNames,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Suggest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
