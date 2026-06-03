import { type NextRequest, NextResponse } from "next/server";
import {
  aiFlowService,
  isAiModuleEnabled,
} from "@/features/ai/ai-flow-service";
import { streamOpenApiQuestion } from "@/domain/ai/pipeline/answer-question-stream";
import { parseChatSelectionFromBody } from "@/lib/ai/chat-selection";
import { guardAiRoute, readAiJsonBody } from "@/lib/ai/route-helpers";
import { validateSpecId } from "@/lib/spec-id";
import type { QAHistoryMessage } from "@/domain/ai/types";

function sseEncode(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}


function sanitizeHistory(input: unknown): QAHistoryMessage[] {
  if (!Array.isArray(input)) return [];
  const out: QAHistoryMessage[] = [];
  for (const item of input.slice(-12)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }
    const text = content.trim().slice(0, 1500);
    if (!text) continue;
    out.push({ role, content: text });
  }
  return out;
}

export async function POST(request: NextRequest) {
  const denied = guardAiRoute(request);
  if (denied) return denied;

  const body = await readAiJsonBody<{
    specId?: string;
    question?: string;
    conversationId?: string;
    stream?: boolean;
    chatProvider?: string;
    chatModel?: string;
    provider?: string;
    model?: string;
    history?: unknown;
  }>(request);
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  const question = body.question?.trim();
  if (!specId || !question) {
    return NextResponse.json(
      { error: "specId and question are required" },
      { status: 400 }
    );
  }
  try {
    validateSpecId(specId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid specId";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let chatSelection;
  try {
    chatSelection = parseChatSelectionFromBody(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid chat selection";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!isAiModuleEnabled()) {
    return NextResponse.json(
      { error: "AI module is disabled or no chat provider is configured" },
      { status: 403 }
    );
  }

  const history = sanitizeHistory(body.history);

  const qaBase = {
    specId,
    question: question.slice(0, 4000),
    conversationId: body.conversationId,
    chatProvider: chatSelection?.provider,
    chatModel: chatSelection?.model,
    history,
  };

  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        void streamOpenApiQuestion(
          qaBase,
          {
            onStatus: (phase) => {
              controller.enqueue(
                encoder.encode(sseEncode("status", { phase }))
              );
            },
            onDelta: (text) => {
              controller.enqueue(
                encoder.encode(sseEncode("delta", { text }))
              );
            },
            onDone: (result) => {
              controller.enqueue(encoder.encode(sseEncode("done", result)));
              controller.close();
            },
            onError: (message) => {
              controller.enqueue(
                encoder.encode(sseEncode("error", { error: message }))
              );
              controller.close();
            },
          }
        ).catch((error) => {
          const message =
            error instanceof Error ? error.message : "Internal Server Error";
          controller.enqueue(
            encoder.encode(sseEncode("error", { error: message }))
          );
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await aiFlowService.answerQuestion(qaBase);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/ai/question:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("not indexed") ? 412 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
