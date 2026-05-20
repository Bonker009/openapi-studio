import { type NextRequest, NextResponse } from "next/server";
import {
  validateSpecId,
  readHistory,
  specExists,
} from "@/lib/spec-versioning";
import { formatDiffCounts } from "@/lib/openapi-diff";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id || !validateSpecId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const history = readHistory(id);
  const canonicalExists = specExists(id);

  const entries = history.map((entry) => ({
    ...entry,
    summaryLabel: entry.summary ? formatDiffCounts(entry.summary) : undefined,
  }));

  return NextResponse.json({
    id,
    current: canonicalExists,
    entries,
  });
}
