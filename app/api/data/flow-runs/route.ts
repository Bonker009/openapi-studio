import { NextRequest, NextResponse } from "next/server";
import type { Flow, FlowRunResult } from "@/domain/flows/types";
import { persistFlowRunMetadata } from "@/infrastructure/flows/flow-persistence-service";
import {
  assertPayloadSize,
  guardDataRoute,
  invalidIdResponse,
  validateDataId,
} from "@/lib/security/data-api";

type PersistFlowRunPayload = {
  flow: Flow;
  run: FlowRunResult;
};

function isPersistFlowRunPayload(body: unknown): body is PersistFlowRunPayload {
  if (!body || typeof body !== "object") return false;
  const payload = body as PersistFlowRunPayload;
  return !!payload.flow?.id && !!payload.flow?.specId && !!payload.run?.steps;
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

  if (!isPersistFlowRunPayload(body)) {
    return NextResponse.json(
      { error: "Invalid flow run payload" },
      { status: 400 }
    );
  }
  if (!validateDataId(body.flow.specId)) return invalidIdResponse();

  await persistFlowRunMetadata({ flow: body.flow, run: body.run });
  return NextResponse.json({ ok: true });
}
