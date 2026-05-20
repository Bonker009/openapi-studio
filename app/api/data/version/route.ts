import { type NextRequest, NextResponse } from "next/server";
import {
  validateSpecId,
  deleteVersionSnapshot,
} from "@/lib/spec-versioning";

export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const ts = params.get("ts");

  if (!id || !validateSpecId(id) || !ts) {
    return NextResponse.json(
      { error: "Missing or invalid id/ts" },
      { status: 400 }
    );
  }

  try {
    deleteVersionSnapshot(id, ts);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting version:", error);
    return NextResponse.json(
      { error: "Failed to delete version" },
      { status: 500 }
    );
  }
}
