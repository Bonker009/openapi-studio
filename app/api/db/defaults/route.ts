import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute } from "@/lib/db/route-helpers";
import {
  getDbConnectEnvDefaults,
  shouldExposeDbConnectPassword,
} from "@/domain/db/resolve-connect-env";

export async function GET(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const defaults = getDbConnectEnvDefaults();
  if (!defaults) {
    return NextResponse.json({ defaults: null });
  }

  const { password, ...rest } = defaults;
  return NextResponse.json({
    defaults: {
      ...rest,
      ...(shouldExposeDbConnectPassword() && password ? { password } : {}),
    },
  });
}
