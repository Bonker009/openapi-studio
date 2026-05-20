import { type NextRequest, NextResponse } from "next/server";
import {
  validateSpecId,
  saveSpecVersion,
  deleteSpecFully,
  getSpec,
  getEndpointStatuses,
  saveEndpointStatuses,
  deleteEndpointStatuses,
  getSpecSettings,
  saveSpecSettings,
  deleteSpecSettings,
} from "@/lib/spec-versioning";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const id = searchParams.get("id") || "default";

  if (!type) {
    return NextResponse.json(
      { error: "Missing type parameter" },
      { status: 400 }
    );
  }

  if (type === "spec" && !validateSpecId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    switch (type) {
      case "spec": {
        const data = getSpec(id);
        if (!data) {
          return NextResponse.json(
            { error: "Specification not found" },
            { status: 404 }
          );
        }
        return NextResponse.json(data);
      }
      case "status": {
        const data = getEndpointStatuses(id);
        return NextResponse.json(data ?? {});
      }
      case "settings": {
        const data = getSpecSettings(id);
        return NextResponse.json(data ?? {});
      }
      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Error reading ${type} data:`, error);
    return NextResponse.json(
      { error: `Failed to read ${type} data` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id = "default", data, meta } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    switch (type) {
      case "spec": {
        if (!validateSpecId(id)) {
          return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }
        const ts = saveSpecVersion(id, data, meta);
        return NextResponse.json({ success: true, ts });
      }
      case "status": {
        saveEndpointStatuses(id, data);
        return NextResponse.json({ success: true });
      }
      case "settings": {
        saveSpecSettings(id, data);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error saving data:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const id = searchParams.get("id") || "default";

  if (!type) {
    return NextResponse.json(
      { error: "Missing type parameter" },
      { status: 400 }
    );
  }

  try {
    switch (type) {
      case "spec": {
        if (!validateSpecId(id)) {
          return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }
        deleteSpecFully(id);
        return NextResponse.json({ success: true });
      }
      case "status": {
        deleteEndpointStatuses(id);
        return NextResponse.json({ success: true });
      }
      case "settings": {
        deleteSpecSettings(id);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Error deleting ${type} data:`, error);
    return NextResponse.json(
      { error: `Failed to delete ${type} data` },
      { status: 500 }
    );
  }
}
