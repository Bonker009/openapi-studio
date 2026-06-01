import { type NextRequest, NextResponse } from "next/server";
import { deleteVersionSnapshot } from "@/lib/spec-versioning";
import { guardDataRoute, invalidIdResponse, validateDataId } from "@/lib/security/data-api";

export async function DELETE(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const ts = params.get("ts");

  if (!id || !validateDataId(id) || !ts) {
    return invalidIdResponse();
  }

  try {
    await deleteVersionSnapshot(id, ts);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting version:", error);
    return NextResponse.json(
      { error: "Failed to delete version" },
      { status: 500 }
    );
  }
}
