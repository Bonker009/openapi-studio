import { type NextRequest, NextResponse } from "next/server";
import {
  aiFlowService,
  isAiModuleEnabled,
} from "@/features/ai/ai-flow-service";
import { streamOpenApiQuestion } from "@/domain/ai/pipeline/answer-question-stream";
import { guardAiRoute, readAiJsonBody } from "@/lib/ai/route-helpers";
import { validateSpecId } from "@/lib/spec-id";

function sseEncode(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const denied = guardAiRoute(request);
  if (denied) return denied;

  const body = await readAiJsonBody<{
    specId?: string;
    question?: string;
    conversationId?: string;
    stream?: boolean;
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

  if (!isAiModuleEnabled()) {
    return NextResponse.json(
      { error: "AI module is disabled or OPENAI_API_KEY is missing" },
      { status: 403 }
    );
  }

  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        void streamOpenApiQuestion(
          {
            specId,
            question: question.slice(0, 4000),
            conversationId: body.conversationId,
          },
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
    const result = await aiFlowService.answerQuestion({
      specId,
      question: question.slice(0, 4000),
      conversationId: body.conversationId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/ai/question:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("not indexed") ? 412 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
