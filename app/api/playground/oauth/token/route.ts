import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRouteAuth,
  isPlaygroundProxyEnabled,
} from "@/lib/security/route-auth";
import { assertSafeOutboundUrl, SsrfError } from "@/lib/security/ssrf-server";

const sharedFields = {
  tokenUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scope: z.string().optional(),
};

const clientCredentialsSchema = z.object({
  grantType: z.literal("client_credentials").optional(),
  ...sharedFields,
});

const refreshTokenSchema = z.object({
  grantType: z.literal("refresh_token"),
  refreshToken: z.string().min(1),
  ...sharedFields,
});

const bodySchema = z.union([clientCredentialsSchema, refreshTokenSchema]);

type TokenBody = z.infer<typeof bodySchema>;

function parseTokenResponse(text: string, res: Response) {
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
  const refreshToken =
    typeof data.refresh_token === "string" ? data.refresh_token : undefined;

  return NextResponse.json({
    accessToken,
    expiresAt,
    tokenType,
    ...(refreshToken ? { refreshToken } : {}),
  });
}

export async function POST(request: NextRequest) {
  const authDenied = checkRouteAuth(request);
  if (authDenied) return authDenied;

  if (!isPlaygroundProxyEnabled()) {
    return NextResponse.json(
      { error: "Playground proxy is disabled" },
      { status: 403 }
    );
  }

  let parsed: TokenBody;
  try {
    const json = await request.json();
    const withGrant =
      json && typeof json === "object" && "grantType" in json
        ? json
        : { ...json, grantType: "client_credentials" };
    parsed = bodySchema.parse(withGrant);
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
  const grantType =
    parsed.grantType === "refresh_token"
      ? "refresh_token"
      : "client_credentials";
  form.set("grant_type", grantType);
  form.set("client_id", parsed.clientId);
  form.set("client_secret", parsed.clientSecret);
  if (parsed.scope?.trim()) form.set("scope", parsed.scope.trim());
  if (grantType === "refresh_token" && "refreshToken" in parsed) {
    form.set("refresh_token", parsed.refreshToken);
  }

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
    return parseTokenResponse(text, res);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Token request failed",
      },
      { status: 502 }
    );
  }
}
