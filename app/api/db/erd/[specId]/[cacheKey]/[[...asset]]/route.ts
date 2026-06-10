import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { liamErdEnabled } from "@/domain/db/config";
import { isValidErdCacheKey } from "@/domain/db/erd-security";
import { resolveErdPasteAssetPath } from "@/features/db/liam-erd-service";
import { guardDbRoute } from "@/lib/db/route-helpers";
import { validateSpecId } from "@/lib/spec-id";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ specId: string; cacheKey: string; asset?: string[] }>;
  }
) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  if (!liamErdEnabled()) {
    return NextResponse.json(
      { error: "Liam ERD is disabled" },
      { status: 403 }
    );
  }

  const { specId: specIdParam, cacheKey, asset } = await context.params;
  const specId = specIdParam?.trim();
  if (!specId || !validateSpecId(specId)) {
    return NextResponse.json({ error: "Invalid specId" }, { status: 400 });
  }
  if (!isValidErdCacheKey(cacheKey)) {
    return NextResponse.json({ error: "ERD asset not found" }, { status: 404 });
  }

  const resolved = await resolveErdPasteAssetPath({
    specId,
    cacheKey,
    assetSegments: asset ?? [],
  });

  if (!resolved) {
    return NextResponse.json({ error: "ERD asset not found" }, { status: 404 });
  }

  let body = await fs.readFile(resolved.filePath);
  let contentType = resolved.contentType;

  if (resolved.filePath.endsWith("index.html")) {
    const html = body.toString("utf8");
    const baseHref = request.nextUrl.pathname.endsWith("/")
      ? request.nextUrl.pathname
      : `${request.nextUrl.pathname}/`;
    const baseTag = `<base href="${baseHref}" />`;
    const injected = html.includes("<base ")
      ? html
      : html.replace("<head>", `<head>\n    ${baseTag}`);
    body = Buffer.from(injected, "utf8");
    contentType = "text/html; charset=utf-8";
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
