import { type NextRequest, NextResponse } from "next/server";
import { listSpecSummaries } from "@/lib/spec-versioning";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  if (!type) {
    return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });
  }

  try {
    if (type !== "spec") {
      return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }

    return NextResponse.json(listSpecSummaries());
  } catch (error) {
    console.error(`Error listing ${type} data:`, error);
    return NextResponse.json(
      { error: `Failed to list ${type} data` },
      { status: 500 }
    );
  }
}
