import { type NextRequest, NextResponse } from "next/server";
import { validateSpecId } from "@/lib/spec-id";
import { checkRouteAuth } from "@/lib/security/route-auth";
import { MAX_SPEC_POST_BYTES } from "@/lib/security/outbound-headers";

export function guardDataRoute(
  request: NextRequest
): NextResponse | null {
  return checkRouteAuth(request);
}

export function validateDataId(id: string): boolean {
  return validateSpecId(id);
}

export function invalidIdResponse(): NextResponse {
  return NextResponse.json({ error: "Invalid id" }, { status: 400 });
}

export function assertPayloadSize(data: unknown): NextResponse | null {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
    if (bytes > MAX_SPEC_POST_BYTES) {
      return NextResponse.json(
        { error: `Payload exceeds ${MAX_SPEC_POST_BYTES} bytes` },
        { status: 413 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  return null;
}
