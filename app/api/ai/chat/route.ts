import { type NextRequest, NextResponse } from "next/server";
import { streamUnifiedChat } from "@/features/ai/unified-assistant-service";
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
    connectionId?: string;
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
    const chat = parseChatSelectionFromBody(body);
    const history = sanitizeHistory(body.history);
    const connectionId = body.connectionId?.trim() || undefined;

    if (body.stream) {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (event: string, data: Record<string, unknown>) => {
            controller.enqueue(enc.encode(sseEncode(event, data)));
          };
          try {
            send("status", { phase: "thinking" });
            await streamUnifiedChat(
              {
                specId,
                question,
                history,
                connectionId,
                chatProvider: chat?.provider,
                chatModel: chat?.model,
              },
              {
                onStatus: (phase) => send("status", { phase }),
                onDelta: (text) => send("delta", { text }),
                onDone: (result) => {
                  send("done", result);
                  controller.close();
                },
                onError: (message) => {
                  send("error", { message });
                  controller.close();
                },
              }
            );
          } catch (e) {
            const message = e instanceof Error ? e.message : "Chat failed";
            send("error", { message });
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    let answer = "";
    let citedEndpoints: string[] = [];
    let meta: Record<string, unknown> = {};

    await streamUnifiedChat(
      {
        specId,
        question,
        history,
        connectionId,
        chatProvider: chat?.provider,
        chatModel: chat?.model,
      },
      {
        onDelta: (text) => {
          answer += text;
        },
        onDone: (result) => {
          answer = result.answer;
          citedEndpoints = result.citedEndpoints;
          meta = {
            toolsUsed: result.toolsUsed,
            connectionId: result.connectionId,
            modelsUsed: result.modelsUsed,
            promptVersion: result.promptVersion,
          };
        },
        onError: (message) => {
          throw new Error(message);
        },
      }
    );

    return NextResponse.json({ answer, citedEndpoints, ...meta });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
