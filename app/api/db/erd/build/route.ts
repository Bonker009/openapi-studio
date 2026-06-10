import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { liamErdEnabled } from "@/domain/db/config";
import { isErdPasteFormat } from "@/domain/db/erd-paste-schema";
import { ensureErdBuildFromPaste } from "@/features/db/liam-erd-service";
import { guardDbRoute } from "@/lib/db/route-helpers";
import { validateSpecId } from "@/lib/spec-id";

const bodySchema = z.object({
  schema: z.string(),
  format: z.string(),
  force: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  if (!liamErdEnabled()) {
    return NextResponse.json(
      { error: "Liam ERD is disabled" },
      { status: 403 }
    );
  }

  const specId = request.nextUrl.searchParams.get("specId")?.trim();
  if (!specId) {
    return NextResponse.json({ error: "specId is required" }, { status: 400 });
  }
  try {
    validateSpecId(specId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid specId";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isErdPasteFormat(body.format)) {
    return NextResponse.json(
      { error: "format must be postgres, prisma, or drizzle" },
      { status: 400 }
    );
  }

  try {
    const result = await ensureErdBuildFromPaste({
      specId,
      content: body.schema,
      format: body.format,
      force: body.force,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ERD build failed";
    const status =
      message.includes("required") ||
      message.includes("No ") ||
      message.includes("limit") ||
      message.includes("disallowed")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
