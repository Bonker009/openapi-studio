import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRouteAuth,
  isPlaygroundProxyEnabled,
} from "@/lib/security/route-auth";
import { assertSafeOutboundUrl, SsrfError } from "@/lib/security/ssrf-server";

const bodySchema = z.object({
  tokenUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scope: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authDenied = checkRouteAuth(request);
  if (authDenied) return authDenied;

  if (!isPlaygroundProxyEnabled()) {
    return NextResponse.json(
      { error: "Playground proxy is disabled" },
      { status: 403 }
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await assertSafeOutboundUrl(parsed.tokenUrl);
  } catch (e) {
    const message = e instanceof SsrfError ? e.message : "URL not allowed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", parsed.clientId);
  form.set("client_secret", parsed.clientSecret);
  if (parsed.scope?.trim()) form.set("scope", parsed.scope.trim());

  try {
    const res = await fetch(parsed.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json(
        { error: "Token endpoint did not return JSON" },
        { status: 502 }
      );
    }

    if (!res.ok) {
      const err =
        typeof data.error_description === "string"
          ? data.error_description
          : typeof data.error === "string"
            ? data.error
            : `Token request failed (${res.status})`;
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const accessToken =
      typeof data.access_token === "string" ? data.access_token : null;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access_token in response" },
        { status: 502 }
      );
    }

    const expiresIn =
      typeof data.expires_in === "number"
        ? data.expires_in
        : typeof data.expires_in === "string"
          ? parseInt(data.expires_in, 10)
          : 3600;

    const expiresAt = Math.floor(Date.now() / 1000) + (expiresIn || 3600);
    const tokenType =
      typeof data.token_type === "string" ? data.token_type : "Bearer";

    return NextResponse.json({
      accessToken,
      expiresAt,
      tokenType,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Token request failed",
      },
      { status: 502 }
    );
  }
}
