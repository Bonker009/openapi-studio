import { type NextRequest, NextResponse } from "next/server";
import { checkRouteAuth } from "@/lib/security/route-auth";
import { readBodyWithLimit } from "@/lib/security/outbound-headers";
import { getAiDisabledReason, isAiModuleEnabled } from "@/lib/ai/config";

export const MAX_AI_REQUEST_BYTES = 256 * 1024;

export function guardAiRoute(request: NextRequest): NextResponse | null {
  const denied = checkRouteAuth(request);
  if (denied) return denied;
  if (!isAiModuleEnabled()) {
    return NextResponse.json(
      {
        error: getAiDisabledReason() ?? "AI module is disabled.",
      },
      { status: 403 }
    );
  }
  return null;
}

export async function readAiJsonBody<T extends Record<string, unknown>>(
  request: NextRequest
): Promise<T | NextResponse> {
  try {
    const raw = await request.text();
    readBodyWithLimit(raw, MAX_AI_REQUEST_BYTES);
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    const status = message.includes("exceeds") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
