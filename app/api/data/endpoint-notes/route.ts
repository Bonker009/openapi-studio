import { type NextRequest, NextResponse } from "next/server";
import { postgresEndpointNotesRepository } from "@/infrastructure/repositories";
import {
  guardDataRoute,
  invalidIdResponse,
  validateDataId,
} from "@/lib/security/data-api";

export async function GET(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id");
  const path = request.nextUrl.searchParams.get("path");
  const method = request.nextUrl.searchParams.get("method");

  if (!id || !validateDataId(id)) return invalidIdResponse();
  if (!path || !method) {
    return NextResponse.json(
      { error: "path and method are required" },
      { status: 400 }
    );
  }

  const notes = await postgresEndpointNotesRepository.list(id, path, method);
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  let body: {
    id?: string;
    path?: string;
    method?: string;
    noteBody?: string;
    kind?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, path, method, noteBody, kind } = body;
  if (!id || !validateDataId(id)) return invalidIdResponse();
  if (!path || !method || !noteBody?.trim()) {
    return NextResponse.json(
      { error: "path, method, and noteBody are required" },
      { status: 400 }
    );
  }

  const note = await postgresEndpointNotesRepository.append(id, path, method, {
    body: noteBody,
    kind,
  });
  return NextResponse.json({ note });
}

export async function DELETE(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id");
  const noteIdRaw = request.nextUrl.searchParams.get("noteId");

  if (!id || !validateDataId(id)) return invalidIdResponse();
  const noteId = Number(noteIdRaw);
  if (!Number.isFinite(noteId)) {
    return NextResponse.json({ error: "Invalid noteId" }, { status: 400 });
  }

  const ok = await postgresEndpointNotesRepository.delete(id, noteId);
  if (!ok) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
