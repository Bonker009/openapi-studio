import { type NextRequest, NextResponse } from "next/server";
import type { Flow } from "@/lib/flows/types";
import { MAX_FLOW_STEPS } from "@/lib/flows/types";
import {
  deletePersistedFlow,
  listPersistedFlows,
  savePersistedFlow,
} from "@/infrastructure/flows/flow-persistence-service";
import {
  assertPayloadSize,
  guardDataRoute,
  invalidIdResponse,
  validateDataId,
} from "@/lib/security/data-api";

function isValidFlow(body: unknown): body is Flow {
  if (!body || typeof body !== "object") return false;
  const f = body as Flow;
  if (typeof f.id !== "string" || !f.id.trim()) return false;
  if (typeof f.specId !== "string" || !f.specId.trim()) return false;
  if (typeof f.name !== "string") return false;
  if (!Array.isArray(f.steps)) return false;
  if (f.steps.length > MAX_FLOW_STEPS) return false;
  if (f.onStepFailure && f.onStepFailure !== "stop" && f.onStepFailure !== "continue") {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !validateDataId(id)) return invalidIdResponse();

  const flows = await listPersistedFlows(id);
  return NextResponse.json({ flows });
}

export async function POST(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sizeErr = assertPayloadSize(body);
  if (sizeErr) return sizeErr;

  if (!isValidFlow(body)) {
    return NextResponse.json({ error: "Invalid flow payload" }, { status: 400 });
  }

  const flow = await savePersistedFlow(body);
  return NextResponse.json({ flow });
}

export async function DELETE(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id");
  const flowId = request.nextUrl.searchParams.get("flowId");

  if (!id || !validateDataId(id)) return invalidIdResponse();
  if (!flowId?.trim()) {
    return NextResponse.json({ error: "flowId is required" }, { status: 400 });
  }

  const ok = await deletePersistedFlow(id, flowId);
  if (!ok) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
