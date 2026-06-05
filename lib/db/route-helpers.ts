import { type NextRequest, NextResponse } from "next/server";
import { checkRouteAuth } from "@/lib/security/route-auth";
import { readBodyWithLimit } from "@/lib/security/outbound-headers";
import { dbAgentEnabled } from "@/domain/db/config";

export const MAX_DB_REQUEST_BYTES = 64 * 1024;

export function guardDbRoute(request: NextRequest): NextResponse | null {
  const denied = checkRouteAuth(request);
  if (denied) return denied;
  if (!dbAgentEnabled()) {
    return NextResponse.json(
      { error: "Database agent module is disabled" },
      { status: 403 }
    );
  }
  return null;
}

export async function readDbJsonBody<T extends Record<string, unknown>>(
  request: NextRequest
): Promise<T | NextResponse> {
  try {
    const raw = await request.text();
    readBodyWithLimit(raw, MAX_DB_REQUEST_BYTES);
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    const status = message.includes("exceeds") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
