import { type NextRequest, NextResponse } from "next/server";
import {
  checkRouteAuth,
  isPlaygroundProxyEnabled,
} from "@/lib/security/route-auth";
import {
  handleJsonProxy,
  handleMultipartProxy,
} from "@/src/infrastructure/playground/proxy-handler";

export async function POST(req: NextRequest) {
  const authError = checkRouteAuth(req);
  if (authError) return authError;

  if (!isPlaygroundProxyEnabled()) {
    return NextResponse.json(
      {
        status: 0,
        error: "Playground proxy is disabled",
        data: null,
        headers: {},
        responseTime: 0,
      },
      { status: 403 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handleMultipartProxy(req);
  }

  return handleJsonProxy(req);
}
