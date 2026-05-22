import { type NextRequest, NextResponse } from "next/server";
import {
  readHistory,
  specExists,
} from "@/lib/spec-versioning";
import { formatDiffCounts } from "@/lib/openapi-diff";
import { guardDataRoute, invalidIdResponse, validateDataId } from "@/lib/security/data-api";

export async function GET(request: NextRequest) {
  const denied = guardDataRoute(request);
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get("id");

  if (!id || !validateDataId(id)) {
    return invalidIdResponse();
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
