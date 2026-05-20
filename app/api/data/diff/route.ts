import { type NextRequest, NextResponse } from "next/server";
import {
  validateSpecId,
  readSpecSnapshot,
} from "@/lib/spec-versioning";
import { diffOpenApi } from "@/lib/openapi-diff";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const from = params.get("from");
  const to = params.get("to") || "current";

  if (!id || !validateSpecId(id) || !from) {
    return NextResponse.json(
      { error: "Missing or invalid id/from parameters" },
      { status: 400 }
    );
  }

  try {
    const oldDoc = readSpecSnapshot(id, from);
    const newDoc = readSpecSnapshot(id, to);

    if (!oldDoc || !newDoc) {
      return NextResponse.json(
        { error: "One or both versions not found" },
        { status: 404 }
      );
    }

    const summary = diffOpenApi(
      oldDoc as Parameters<typeof diffOpenApi>[0],
      newDoc as Parameters<typeof diffOpenApi>[1]
    );

    return NextResponse.json({ id, from, to, summary });
  } catch (error) {
    console.error("Error computing diff:", error);
    return NextResponse.json({ error: "Failed to compute diff" }, { status: 500 });
  }
}
