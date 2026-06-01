import { type NextRequest, NextResponse } from "next/server";
import { readSpecSnapshot } from "@/lib/spec-versioning";
import { diffOpenApi } from "@/lib/openapi-diff";
import { guardDataRoute, invalidIdResponse, validateDataId } from "@/lib/security/data-api";

export async function GET(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const from = params.get("from");
  const to = params.get("to") || "current";

  if (!id || !validateDataId(id) || !from) {
    return invalidIdResponse();
  }

  try {
    const oldDoc = await readSpecSnapshot(id, from);
    const newDoc = await readSpecSnapshot(id, to);

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
