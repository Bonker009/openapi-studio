import { type NextRequest, NextResponse } from "next/server";
import { getChatProviderCatalog } from "@/infrastructure/ai/chat-provider-config";
import { getTaskModelsCatalog } from "@/domain/ai/model-task-routing";
import { getAiDisabledReason } from "@/lib/ai/module-status";
import { checkRouteAuth } from "@/lib/security/route-auth";

/** Public catalog of configured chat providers/models for the AI assistant UI. */
export async function GET(request: NextRequest) {
  const denied = checkRouteAuth(request);
  if (denied) return denied;

  const disabledReason = getAiDisabledReason();
  const catalog = getChatProviderCatalog();

  let taskModels = null;
  try {
    taskModels = getTaskModelsCatalog();
  } catch {
    taskModels = null;
  }

  return NextResponse.json({
    enabled: disabledReason === null,
    disabledReason,
    taskModels,
    ...catalog,
  });
}
