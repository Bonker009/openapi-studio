import { type NextRequest, NextResponse } from "next/server";
import { guardDbRoute, readDbJsonBody } from "@/lib/db/route-helpers";
import { dbAgentService } from "@/features/db/db-agent-service";
import { parseChatSelectionFromBody } from "@/lib/ai/chat-selection";
import { validateSpecId } from "@/lib/spec-id";
import type { QAHistoryMessage } from "@/domain/ai/types";

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

function sseEncode(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const denied = guardDbRoute(request);
  if (denied) return denied;

  const body = await readDbJsonBody<{
    specId?: string;
    connectionId?: string;
    question?: string;
    conversationId?: string;
    stream?: boolean;
    history?: unknown;
    chatProvider?: string;
    chatModel?: string;
    provider?: string;
    model?: string;
  }>(request);
  if (body instanceof NextResponse) return body;

  const specId = body.specId?.trim();
  const connectionId = body.connectionId?.trim();
  const question = body.question?.trim();
  if (!specId || !connectionId || !question) {
    return NextResponse.json(
      { error: "specId, connectionId, and question are required" },
      { status: 400 }
    );
  }

  try {
    validateSpecId(specId);
    const chat = parseChatSelectionFromBody(body);
    const history = sanitizeHistory(body.history);

    if (body.stream) {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (event: string, data: Record<string, unknown>) => {
            controller.enqueue(enc.encode(sseEncode(event, data)));
          };
          try {
            send("status", { phase: "thinking" });
            await dbAgentService.askStream(
              {
                specId,
                connectionId,
                question,
                conversationId: body.conversationId,
                history,
                chatProvider: chat?.provider,
                chatModel: chat?.model,
              },
              {
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
            const message = e instanceof Error ? e.message : "Agent failed";
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

    const result = await dbAgentService.ask({
      specId,
      connectionId,
      question,
      conversationId: body.conversationId,
      history,
      chatProvider: chat?.provider,
      chatModel: chat?.model,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
