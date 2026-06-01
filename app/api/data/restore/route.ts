import { type NextRequest, NextResponse } from "next/server";
import { readSpecSnapshot, saveSpecVersion } from "@/lib/spec-versioning";
import {
  guardDataRoute,
  invalidIdResponse,
  validateDataId,
} from "@/lib/security/data-api";

export async function POST(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, ts } = body;

    if (!id || !validateDataId(id) || !ts) {
      return invalidIdResponse();
    }

    const snapshot = await readSpecSnapshot(id, ts);
    if (!snapshot) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const newTs = await saveSpecVersion(id, snapshot, {
      note: `Restored from version ${ts}`,
      isRestore: true,
    });

    return NextResponse.json({ success: true, ts: newTs });
  } catch (error) {
    console.error("Error restoring version:", error);
    return NextResponse.json({ error: "Failed to restore" }, { status: 500 });
  }
}
