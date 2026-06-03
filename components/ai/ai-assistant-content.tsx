"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AiChatProvider,
  AiChatSettings,
  AiConfigApiResponse,
} from "@/components/ai/ai-chat-provider-types";
import { formatChatModelLabel } from "@/components/ai/format-chat-model-label";
import {
  loadAiAssistantState,
  saveAiAssistantState,
  type PersistedChatMessage,
} from "@/components/ai/ai-assistant-persistence";
import { cn } from "@/lib/utils";

export type AiAssistantContentProps = {
  specId: string;
  defaultBaseUrl?: string;
  /** When set, show Apply to draft after flow generation (flow tests page). */
  onApplyGeneratedFlow?: (flow: Flow) => void;
  className?: string;
};

type ChatMessage = PersistedChatMessage & {
  streaming?: boolean;
};

export function AiAssistantContent({
  specId,
  defaultBaseUrl,
  onApplyGeneratedFlow,
  className,
}: AiAssistantContentProps) {
  const initialPersisted = useMemo(
    () => loadAiAssistantState(specId),
    [specId]
  );

  const [activeTab, setActiveTab] = useState(
    () => initialPersisted.activeTab ?? "qa"
  );
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<IndexOpenApiResult | null>(
    () => initialPersisted.indexResult ?? null
  );
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    () => initialPersisted.messages
  );
  const [chatCatalog, setChatCatalog] = useState<AiConfigApiResponse | null>(
    null
  );
  const [chatSettings, setChatSettings] = useState<AiChatSettings | null>(
    null
  );
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const asking =
    chatStatus === "connecting" || chatStatus === "streaming";

  const persistToStorage = useCallback(() => {
    saveAiAssistantState(specId, {
      messages: chatMessages
        .slice(-50)
        .map(({ streaming: _s, ...rest }) => rest),
      activeTab,
      chatProvider: chatSettings?.provider,
      chatModel: chatSettings?.model,
      indexResult,
    });
  }, [specId, chatMessages, activeTab, chatSettings, indexResult]);

  useEffect(() => {
    if (defaultBaseUrl) setBaseUrl(defaultBaseUrl);
  }, [defaultBaseUrl]);

  useEffect(() => {
    const stored = loadAiAssistantState(specId);
    setChatMessages(stored.messages);
    setIndexResult(stored.indexResult ?? null);
    setActiveTab(stored.activeTab ?? "qa");
  }, [specId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ai/config");
        if (!res.ok || cancelled) return;
        const catalog = (await res.json()) as AiConfigApiResponse;
        if (cancelled) return;
        setChatCatalog(catalog);

        const stored = loadAiAssistantState(specId);
        const storedProvider = stored.chatProvider;
        const storedModel = stored.chatModel?.trim();
        const providerEntry =
          storedProvider &&
          catalog.providers.find((p) => p.id === storedProvider);
        if (
          providerEntry &&
          storedModel &&
          providerEntry.models.includes(storedModel)
        ) {
          setChatSettings({ provider: storedProvider, model: storedModel });
        } else if (catalog.defaultProvider && catalog.defaultModel) {
          setChatSettings({
            provider: catalog.defaultProvider,
            model: catalog.defaultModel,
          });
        } else if (catalog.providers[0]) {
          const first = catalog.providers[0];
          setChatSettings({
            provider: first.id,
            model: first.defaultModel,
          });
        }
      } catch {
        // ignore config load errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [specId]);

  useEffect(() => {
    persistToStorage();
  }, [persistToStorage]);

  useEffect(() => {
    return () => {
      saveAiAssistantState(specId, {
        messages: chatMessages
          .slice(-50)
          .map(({ streaming: _s, ...rest }) => rest),
        activeTab,
        chatProvider: chatSettings?.provider,
        chatModel: chatSettings?.model,
        indexResult,
      });
    };
  }, [specId, chatMessages, activeTab, chatSettings, indexResult]);

  const activeProviderEntry = useMemo(() => {
    if (!chatCatalog || !chatSettings) return null;
    return (
      chatCatalog.providers.find((p) => p.id === chatSettings.provider) ?? null
    );
  }, [chatCatalog, chatSettings]);

  const modelOptions = activeProviderEntry?.models ?? [];

  function handleProviderChange(nextProvider: AiChatProvider) {
    const entry = chatCatalog?.providers.find((p) => p.id === nextProvider);
    if (!entry) return;
    setChatSettings({
      provider: nextProvider,
      model: entry.defaultModel,
    });
  }

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
    if (!q || asking || !chatSettings) return;

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

    const history = chatMessages
      .filter(
        (m): m is ChatMessage & { role: "user" | "assistant" } =>
          (m.role === "user" || m.role === "assistant") &&
          !m.streaming &&
          m.content.trim().length > 0
      )
      .slice(-12)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1500),
      }));

    setChatMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setQuestion("");
    setChatStatus("connecting");
    setStreamPhase("connecting");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    await streamQuestionRequest(
      {
        specId,
        question: q,
        signal: ac.signal,
        chatProvider: chatSettings.provider,
        chatModel: chatSettings.model,
        history,
      },
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
            {chatCatalog && chatCatalog.providers.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={chatSettings?.provider ?? ""}
                  onValueChange={(v) =>
                    handleProviderChange(v as AiChatProvider)
                  }
                  disabled={asking}
                >
                  <SelectTrigger size="sm" className="w-[120px]">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {chatCatalog.providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={chatSettings?.model ?? ""}
                  onValueChange={(model) =>
                    setChatSettings((prev) =>
                      prev ? { ...prev, model } : prev
                    )
                  }
                  disabled={asking || modelOptions.length === 0}
                >
                  <SelectTrigger size="sm" className="min-w-[180px] flex-1">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {chatSettings
                          ? formatChatModelLabel(chatSettings.provider, m)
                          : m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : chatCatalog && !chatCatalog.enabled ? (
              <p className="text-xs text-muted-foreground">
                {chatCatalog.disabledReason ?? "AI chat is not configured."}
              </p>
            ) : null}
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
              disabled={asking || !chatSettings}
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
                  disabled={!question.trim() || !chatSettings}
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
