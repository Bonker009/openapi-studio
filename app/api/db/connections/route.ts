import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute, readDbJsonBody } from "@/lib/db/route-helpers";
import { DB_TERMS_VERSION } from "@/domain/db/config";
import { dbConnectionService } from "@/features/db/db-connection-service";
import { validateSpecId } from "@/lib/spec-id";

export async function GET(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const specId = request.nextUrl.searchParams.get("specId")?.trim();
  if (!specId) {
    return NextResponse.json({ error: "specId is required" }, { status: 400 });
  }
  try {
    validateSpecId(specId);
    const connections = await dbConnectionService.list(specId);
    return NextResponse.json({ connections });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list connections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const body = await readDbJsonBody<{
    specId?: string;
    label?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    sslMode?: string;
    connectionUri?: string;
    acceptedTerms?: boolean;
    termsVersion?: string;
  }>(request);
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  if (!specId) {
    return NextResponse.json({ error: "specId is required" }, { status: 400 });
  }
  try {
    validateSpecId(specId);
    let host = body.host?.trim();
    let port = body.port ?? 5432;
    let database = body.database?.trim();
    let username = body.username?.trim();
    let password = body.password ?? "";

    if (body.connectionUri?.trim()) {
      const { parseConnectionUri } = await import(
        "@/infrastructure/db/postgres-user-client"
      );
      const parsed = parseConnectionUri(body.connectionUri.trim());
      host = parsed.host;
      port = parsed.port;
      database = parsed.database;
      username = parsed.username;
      password = parsed.password;
    }

    if (!host || !database || !username) {
      return NextResponse.json(
        { error: "host, database, username, and password (or connectionUri) are required" },
        { status: 400 }
      );
    }

    const row = await dbConnectionService.create({
      specId,
      label: body.label?.trim() || `${host}/${database}`,
      host,
      port: Number(port) || 5432,
      database,
      username,
      password,
      sslMode: body.sslMode,
      termsVersion: body.termsVersion?.trim() || DB_TERMS_VERSION,
      acceptedTerms: Boolean(body.acceptedTerms),
    });

    return NextResponse.json({
      connection: {
        id: row!.id,
        specId: row!.specId,
        label: row!.label,
        host: row!.host,
        port: row!.port,
        database: row!.database,
        username: row!.username,
        sslMode: row!.sslMode,
        status: row!.status,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create connection";
    const status = message.includes("terms") || message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
