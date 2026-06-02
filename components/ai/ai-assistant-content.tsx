"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Square } from "lucide-react";
import type {
  GenerateFlowOutput,
  IndexOpenApiResult,
} from "@/domain/ai/types";
import type { Flow } from "@/domain/flows/types";
import { postJson } from "@/components/ai/ai-api-client";
import { streamQuestionRequest } from "@/components/ai/stream-question-client";
import { AiChatMarkdown } from "@/components/ai/ai-chat-markdown";
import {
  AiChatComposerStatus,
  AiChatStreamCursor,
  AiChatTypingIndicator,
  AiOperationLoading,
  type AiStreamPhase,
} from "@/components/ai/ai-chat-streaming-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AiAssistantContentProps = {
  specId: string;
  defaultBaseUrl?: string;
  /** When set, show Apply to draft after flow generation (flow tests page). */
  onApplyGeneratedFlow?: (flow: Flow) => void;
  className?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  citedEndpoints?: string[];
  streaming?: boolean;
};

type PersistedAiChatState = {
  messages: ChatMessage[];
  activeTab?: string;
};

export function AiAssistantContent({
  specId,
  defaultBaseUrl,
  onApplyGeneratedFlow,
  className,
}: AiAssistantContentProps) {
  const [activeTab, setActiveTab] = useState("qa");
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<IndexOpenApiResult | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  const [intent, setIntent] = useState(
    "Create a smoke test flow that logs in then validates a core read endpoint."
  );
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl ?? "");
  const [generatingFlow, setGeneratingFlow] = useState(false);
  const [flowResult, setFlowResult] = useState<GenerateFlowOutput | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [chatStatus, setChatStatus] = useState<
    "idle" | "connecting" | "streaming" | "error"
  >("idle");
  const [streamPhase, setStreamPhase] = useState<AiStreamPhase>("idle");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const asking =
    chatStatus === "connecting" || chatStatus === "streaming";

  const chatStorageKey = useMemo(
    () => `ai_assistant_chat:${specId}`,
    [specId]
  );

  useEffect(() => {
    if (defaultBaseUrl) setBaseUrl(defaultBaseUrl);
  }, [defaultBaseUrl]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedAiChatState;
      if (Array.isArray(parsed.messages)) {
        setChatMessages(parsed.messages);
      }
      if (parsed.activeTab) {
        setActiveTab(parsed.activeTab);
      }
    } catch {
      // ignore invalid cache content
    }
  }, [chatStorageKey]);

  useEffect(() => {
    try {
      const payload: PersistedAiChatState = {
        messages: chatMessages
          .slice(-50)
          .map(({ streaming: _s, ...rest }) => rest),
        activeTab,
      };
      localStorage.setItem(chatStorageKey, JSON.stringify(payload));
    } catch {
      // ignore quota/storage errors
    }
  }, [chatMessages, activeTab, chatStorageKey]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages, chatStatus, streamPhase]);

  const indexed = Boolean(indexResult);

  function updateAssistantMessage(
    assistantId: string,
    patch: Partial<ChatMessage>
  ) {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
    );
  }

  function handleStopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatStatus("idle");
    setStreamPhase("idle");
    setChatMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  }

  async function handleIndexOpenApi() {
    setIndexing(true);
    setIndexError(null);
    const result = await postJson<IndexOpenApiResult>("/api/ai/index-openapi", {
      specId,
      force: true,
    });
    setIndexing(false);
    if (!result.ok) {
      setIndexError(result.error ?? "Failed to index OpenAPI");
      return;
    }
    setIndexResult(result.data ?? null);
  }

  async function handleGenerateFlow() {
    setGeneratingFlow(true);
    setFlowError(null);
    const result = await postJson<GenerateFlowOutput>("/api/ai/flow", {
      specId,
      userIntent: intent,
      baseUrl: baseUrl.trim() || undefined,
    });
    setGeneratingFlow(false);
    if (!result.ok) {
      setFlowError(result.error ?? "Failed to generate flow");
      return;
    }
    setFlowResult(result.data ?? null);
  }

  async function handleAskQuestion() {
    const q = question.trim();
    if (!q || asking) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: q,
    };
    const assistantId = `a-${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setChatMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setQuestion("");
    setChatStatus("connecting");
    setStreamPhase("connecting");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    await streamQuestionRequest(
      { specId, question: q, signal: ac.signal },
      {
        onOpen: () => {
          setStreamPhase((prev) =>
            prev === "connecting" ? "retrieving" : prev
          );
        },
        onStatus: (phase) => {
          setStreamPhase(phase);
        },
        onDelta: (text) => {
          setChatStatus("streaming");
          setStreamPhase("streaming");
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + text, streaming: true }
                : m
            )
          );
        },
        onDone: (result) => {
          updateAssistantMessage(assistantId, {
            content: result.answer,
            citedEndpoints: result.citedEndpoints,
            streaming: false,
          });
          setChatStatus("idle");
          setStreamPhase("idle");
          abortRef.current = null;
        },
        onError: (message) => {
          if (ac.signal.aborted) {
            updateAssistantMessage(assistantId, {
              content: "Generation stopped.",
              streaming: false,
            });
            setChatStatus("idle");
            setStreamPhase("idle");
          } else {
            setChatMessages((prev) => {
              const withoutPlaceholder = prev.filter((m) => m.id !== assistantId);
              return [
                ...withoutPlaceholder,
                {
                  id: `e-${Date.now()}`,
                  role: "error",
                  content: message,
                },
              ];
            });
            setChatStatus("error");
            setStreamPhase("idle");
          }
          abortRef.current = null;
        },
      }
    );
  }

  const statusLabel = useMemo(() => {
    if (indexing) return "Indexing…";
    if (indexed) return "Indexed";
    return "Not indexed";
  }, [indexing, indexed]);

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Badge variant={indexed ? "default" : "outline"}>{statusLabel}</Badge>
        {flowResult ? (
          <Badge variant="outline">
            {flowResult.flowSchema.nodes.length} nodes generated
          </Badge>
        ) : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="qa" className="flex-1">
            Ask Docs
          </TabsTrigger>
          <TabsTrigger value="flow" className="flex-1">
            Generate Flow
          </TabsTrigger>
          <TabsTrigger value="index" className="flex-1">
            Index
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="qa"
          className="mt-3 flex flex-col flex-1 min-h-0 data-[state=inactive]:hidden"
        >
          <div
            ref={chatScrollRef}
            className="flex-1 min-h-[240px] overflow-y-auto rounded-lg border bg-muted/20 p-3 space-y-3"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-2">
                <p className="text-sm font-medium">Ask about this API</p>
                <p className="text-sm text-muted-foreground">
                  Auth, payloads, responses, or endpoint behavior. Index the spec
                  first for best results.
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isActiveStream =
                  msg.role === "assistant" &&
                  msg.streaming &&
                  (chatStatus === "connecting" || chatStatus === "streaming");
                const showTyping =
                  isActiveStream && !msg.content.trim();
                const showCursor =
                  isActiveStream && Boolean(msg.content.trim());

                return (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm max-w-[92%] transition-shadow duration-200",
                    msg.role === "user" &&
                      "ml-auto bg-primary text-primary-foreground",
                    msg.role === "assistant" &&
                      "mr-auto bg-card border shadow-sm",
                    isActiveStream &&
                      "ring-1 ring-primary/20 border-primary/30",
                    msg.role === "error" &&
                      "mr-auto bg-destructive/10 text-destructive border border-destructive/30"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="min-w-0 min-h-[1.25rem]">
                      {showTyping ? (
                        <AiChatTypingIndicator
                          label={
                            streamPhase === "connecting"
                              ? "Connecting…"
                              : streamPhase === "retrieving"
                                ? "Searching spec…"
                                : streamPhase === "generating"
                                  ? "Thinking…"
                                  : "Writing…"
                          }
                        />
                      ) : null}
                      {msg.content.trim() ? (
                        <>
                          <AiChatMarkdown content={msg.content} />
                          {showCursor ? <AiChatStreamCursor /> : null}
                        </>
                      ) : msg.content ? (
                        <p className="text-xs text-muted-foreground italic">
                          {msg.content}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.citedEndpoints && msg.citedEndpoints.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.citedEndpoints.map((ep) => (
                        <Badge
                          key={ep}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {ep}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
              })
            )}
          </div>
          <div className="mt-3 shrink-0 space-y-2 border-t pt-3">
            {asking ? <AiChatComposerStatus phase={streamPhase} /> : null}
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                asking
                  ? "Waiting for response…"
                  : "Ask a documentation question…"
              }
              className={cn(
                "min-h-11 max-h-28 resize-none",
                asking && "opacity-80"
              )}
              disabled={asking}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleAskQuestion();
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              {asking ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleStopGeneration}
                >
                  <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleAskQuestion()}
                  disabled={!question.trim()}
                >
                  Send
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  handleStopGeneration();
                  setChatMessages([]);
                  setChatStatus("idle");
                  setStreamPhase("idle");
                }}
                disabled={asking || chatMessages.length === 0}
              >
                Clear
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="flow" className="mt-3 space-y-3 overflow-y-auto max-h-[55vh]">
          <p className="text-sm text-muted-foreground">
            Describe the test flow in natural language. Output is validated against
            this spec&apos;s endpoints.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Intent</label>
            <Textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Describe the flow you want..."
              className="min-h-20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL (optional)</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
            />
          </div>
          <Button
            onClick={() => void handleGenerateFlow()}
            disabled={generatingFlow}
          >
            {generatingFlow ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate Flow"
            )}
          </Button>
          {generatingFlow ? (
            <AiOperationLoading
              title="Generating flow"
              description="Planning steps, mapping endpoints, and validating against your spec. This may take a moment."
            />
          ) : null}
          {flowError ? (
            <Alert variant="destructive">
              <AlertTitle>Flow generation failed</AlertTitle>
              <AlertDescription>{flowError}</AlertDescription>
            </Alert>
          ) : null}
          {flowResult ? (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{flowResult.plan.steps.length} steps</Badge>
                <Badge variant="outline">
                  {flowResult.flowSchema.nodes.length} nodes
                </Badge>
                <Badge variant="outline">
                  {flowResult.cached ? "Cached" : `${flowResult.attempts} attempts`}
                </Badge>
              </div>
              {onApplyGeneratedFlow ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApplyGeneratedFlow(flowResult.internalFlow)}
                >
                  Apply to current draft
                </Button>
              ) : null}
              <Textarea
                readOnly
                className="font-mono text-xs min-h-40"
                value={JSON.stringify(flowResult.flowSchema, null, 2)}
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="index" className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Build embeddings and endpoint index. Required before Ask Docs and
            Generate Flow work reliably.
          </p>
          <Button onClick={() => void handleIndexOpenApi()} disabled={indexing}>
            {indexing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Indexing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Index This Spec
              </>
            )}
          </Button>
          {indexing ? (
            <AiOperationLoading
              title="Indexing OpenAPI"
              description="Chunking operations, building embeddings, and updating the endpoint catalog for RAG."
            />
          ) : null}
          {indexError ? (
            <Alert variant="destructive">
              <AlertTitle>Indexing failed</AlertTitle>
              <AlertDescription>{indexError}</AlertDescription>
            </Alert>
          ) : null}
          {indexResult ? (
            <Alert>
              <AlertTitle>Index ready</AlertTitle>
              <AlertDescription>
                {indexResult.chunkCount} chunks, {indexResult.endpointCount}{" "}
                endpoints.
              </AlertDescription>
            </Alert>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
