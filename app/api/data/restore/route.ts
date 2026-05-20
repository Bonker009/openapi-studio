import { type NextRequest, NextResponse } from "next/server";
import {
  validateSpecId,
  readSpecSnapshot,
  saveSpecVersion,
} from "@/lib/spec-versioning";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ts } = body;

    if (!id || !validateSpecId(id) || !ts) {
      return NextResponse.json(
        { error: "Missing or invalid id/ts" },
        { status: 400 }
      );
    }

    const snapshot = readSpecSnapshot(id, ts);
    if (!snapshot) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const newTs = saveSpecVersion(id, snapshot, {
      note: `Restored from version ${ts}`,
      isRestore: true,
    });

    return NextResponse.json({ success: true, ts: newTs });
  } catch (error) {
    console.error("Error restoring version:", error);
    return NextResponse.json({ error: "Failed to restore" }, { status: 500 });
  }
}
