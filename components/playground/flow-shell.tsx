"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Copy,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  StepForward,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnvironmentSwitcher } from "@/components/playground/environment-switcher";
import { TokenPanel } from "@/components/playground/token-panel";
import { FlowBuilder } from "@/components/playground/flow-builder";
import { FlowDiagram } from "@/components/playground/flow-diagram";
import { FlowResultsPanel } from "@/components/playground/flow-results-panel";
import {
  FlowTutorialDialog,
  hasSeenFlowTutorial,
  markFlowTutorialSeen,
} from "@/components/playground/flow-tutorial-dialog";
import {
  buildSampleFlow,
  canBuildSampleFlow,
} from "@/lib/flows/sample-flow";
import { PayloadTreeView } from "@/components/playground/payload-picker";
import { extractPlaygroundEndpoints } from "@/lib/playground/endpoints";
import {
  getCredentials,
  type Credential,
} from "@/lib/playground/credentials";
import { executePlaygroundRequest } from "@/lib/playground/execute-request";
import { runFlow, type PauseDecision } from "@/lib/flows/run-flow";
import { orderSteps } from "@/lib/flows/order";
import type { RunContext } from "@/lib/flows/resolve-refs";
import { getStepPayload, type StepPayload } from "@/lib/flows/payload-tree";
import {
  persistFlowRun,
  deleteFlow,
  listFlows,
  saveFlow,
} from "@/lib/data-service";
import {
  emptyFlow,
  flowEndpointKey,
  type Flow,
  type FlowExecutionMode,
  type FlowRunResult,
  type StepRunResult,
} from "@/lib/flows/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AiFloatingButton } from "@/components/ai/ai-floating-button";

type PauseState = {
  stepId: string;
  index: number;
  total: number;
  method: string;
  path: string;
  payload: StepPayload;
};

type PauseCapture = { name: string; path: string; preview: string };

function suggestVarName(path: string): string {
  const last = path.split(".").pop() ?? "";
  return last.replace(/\[\d+\]/g, "") || "value";
}

type FlowShellProps = {
  specId: string;
  specTitle: string;
  specVersion?: string;
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
    security?: unknown[];
    servers?: { url: string; description?: string }[];
  };
};

export function FlowShell({
  specId,
  specTitle,
  specVersion,
  apiData,
}: FlowShellProps) {
  const [baseUrl, setBaseUrl] = useState(
    apiData.servers?.[0]?.url?.replace(/\/$/, "") ?? "http://localhost:8080"
  );
  const [activeCredential, setActiveCredential] = useState<Credential | null>(
    null
  );
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [savedFlows, setSavedFlows] = useState<Flow[]>([]);
  const [draft, setDraft] = useState<Flow>(() => emptyFlow(specId));
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState<StepRunResult[]>([]);
  const [runOutcome, setRunOutcome] = useState<FlowRunResult["outcome"] | null>(
    null
  );
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | undefined>();
  const [runFinishedAt, setRunFinishedAt] = useState<number | undefined>();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("builder");
  const [flowsDialogOpen, setFlowsDialogOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [pauseState, setPauseState] = useState<PauseState | null>(null);
  const [pauseCaptures, setPauseCaptures] = useState<PauseCapture[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const pauseResolverRef = useRef<((d: PauseDecision) => void) | null>(null);
  const lastContextRef = useRef<RunContext | null>(null);
  const runOrderIdsRef = useRef<string[]>([]);
  const runResultsRef = useRef<StepRunResult[]>([]);

  useEffect(() => {
    runResultsRef.current = runResults;
  }, [runResults]);

  const endpoints = useMemo(
    () =>
      extractPlaygroundEndpoints({
        paths: apiData.paths as Record<string, Record<string, unknown>> | undefined,
        security: apiData.security,
      }),
    [apiData.paths, apiData.security]
  );

  const dirty = useMemo(
    () => JSON.stringify(draft) !== savedSnapshot,
    [draft, savedSnapshot]
  );

  const stepsById = useMemo(
    () => new Map(draft.steps.map((s) => [s.id, s] as const)),
    [draft.steps]
  );

  const refreshCredentials = useCallback(() => {
    setCredentials(getCredentials(specId));
  }, [specId]);

  const loadFlows = useCallback(async () => {
    try {
      setLoadingFlows(true);
      const flows = await listFlows(specId);
      setSavedFlows(flows);
    } catch {
      toast.error("Failed to load flows");
    } finally {
      setLoadingFlows(false);
    }
  }, [specId]);

  useEffect(() => {
    refreshCredentials();
    loadFlows();
  }, [refreshCredentials, loadFlows]);

  const sampleFlowAvailable = useMemo(
    () => canBuildSampleFlow(endpoints),
    [endpoints]
  );

  const executionMode = draft.executionMode ?? "sequential";

  useEffect(() => {
    if (!hasSeenFlowTutorial(specId)) {
      setTutorialOpen(true);
    }
  }, [specId]);

  const handleTutorialOpenChange = (open: boolean) => {
    setTutorialOpen(open);
    if (!open) markFlowTutorialSeen(specId);
  };

  const loadSampleFlow = () => {
    const built = buildSampleFlow(specId, endpoints, apiData, baseUrl);
    if (!built.ok) {
      toast.error(built.reason);
      return;
    }
    if (dirty && !confirm("Replace the current draft with the example flow?")) {
      return;
    }
    setDraft(built.flow);
    setSavedSnapshot("");
    setRunResults([]);
    setRunOutcome(null);
    setSelectedStepId(null);
    setActiveTab("builder");
    toast.success("Example flow loaded");
  };

  const selectFlow = (flow: Flow) => {
    if (dirty && !confirm("Discard unsaved changes to this flow?")) return;
    setDraft(flow);
    setSavedSnapshot(JSON.stringify(flow));
    setRunResults([]);
    setRunOutcome(null);
    setSelectedStepId(null);
    setFlowsDialogOpen(false);
  };

  const newFlow = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    const f = emptyFlow(specId, "New flow");
    setDraft(f);
    setSavedSnapshot(JSON.stringify(f));
    setRunResults([]);
    setRunOutcome(null);
    setFlowsDialogOpen(false);
  };

  const applyGeneratedFlow = useCallback(
    (flow: Flow) => {
      if (dirty && !confirm("Replace the current draft with the AI-generated flow?")) {
        return;
      }
      setDraft(flow);
      setSavedSnapshot("");
      setRunResults([]);
      setRunOutcome(null);
      setSelectedStepId(null);
      setActiveTab("builder");
      toast.success("AI flow applied to draft");
    },
    [dirty]
  );

  const duplicateFlow = () => {
    const copy: Flow = {
      ...draft,
      id: `flow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: `${draft.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setDraft(copy);
    setSavedSnapshot("");
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error("Flow name is required");
      return;
    }
    if (draft.steps.length === 0) {
      toast.error("Add at least one step before saving");
      return;
    }
    try {
      const saved = await saveFlow({ ...draft, specId });
      setDraft(saved);
      setSavedSnapshot(JSON.stringify(saved));
      await loadFlows();
      toast.success("Flow saved");
    } catch {
      toast.error("Failed to save flow");
    }
  };

  const handleDelete = async (flowId: string) => {
    if (!confirm("Delete this flow?")) return;
    try {
      await deleteFlow(specId, flowId);
      if (draft.id === flowId) newFlow();
      await loadFlows();
      toast.success("Flow deleted");
    } catch {
      toast.error("Failed to delete flow");
    }
  };

  const handleRun = useCallback(async (options?: {
    stepThrough?: boolean;
    startStepId?: string;
  }) => {
    const { stepThrough = false, startStepId } = options ?? {};
    const executionMode = draft.executionMode ?? "sequential";
    if (stepThrough && executionMode === "parallel") {
      toast.error("Step through is not available in parallel mode");
      return;
    }
    if (draft.steps.length === 0) {
      toast.error("Add at least one step to run");
      return;
    }
    if (runningRef.current) return;

    const ordered = orderSteps(draft);
    const orderedIds = ordered.map((s) => s.id);

    // Resolve a resume start index (reusing prior results/context), else full run.
    let startIndex = 0;
    if (startStepId) {
      const idx = ordered.findIndex((s) => s.id === startStepId);
      const prefixOk =
        idx > 0 &&
        lastContextRef.current != null &&
        runOrderIdsRef.current.length >= idx &&
        runResultsRef.current.length >= idx &&
        orderedIds
          .slice(0, idx)
          .every((id, i) => runOrderIdsRef.current[i] === id);
      if (idx <= 0) {
        startIndex = 0;
      } else if (prefixOk) {
        startIndex = idx;
      } else {
        toast.info("Flow changed since the last run; running from the start.");
        startIndex = 0;
      }
    }

    const isResume = startIndex > 0;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    runningRef.current = true;
    setRunning(true);
    if (!isResume) setRunResults([]);
    setRunOutcome(null);
    setRunningIndex(startIndex);
    const started = Date.now();
    setRunStartedAt(started);
    setRunFinishedAt(undefined);

    try {
      const result = await runFlow({
        flow: { ...draft, steps: ordered },
        endpoints,
        baseUrl,
        credentials,
        defaultCredential: activeCredential,
        specId,
        onCredentialRefresh: setActiveCredential,
        execute: executePlaygroundRequest,
        signal: ac.signal,
        stepThrough,
        startIndex,
        seedContext: isResume ? lastContextRef.current ?? undefined : undefined,
        priorResults: isResume
          ? runResultsRef.current.slice(0, startIndex)
          : undefined,
        onProgress: (stepResult, index) => {
          setRunResults((prev) => {
            const next = [...prev];
            next[index] = stepResult;
            return next;
          });
          setRunningIndex(index + 1 < draft.steps.length ? index + 1 : null);
        },
        onPause: (info) =>
          new Promise<PauseDecision>((resolve) => {
            const endpoint = endpoints.find(
              (e) => flowEndpointKey(e) === info.step.endpointKey
            );
            const payload = getStepPayload(
              endpoint,
              apiData,
              baseUrl,
              info.result
            );
            setPauseCaptures([]);
            setPauseState({
              stepId: info.step.id,
              index: info.index,
              total: info.total,
              method: info.result.method,
              path: info.result.path,
              payload,
            });
            pauseResolverRef.current = resolve;
          }),
      });
      setRunResults(result.steps);
      setRunOutcome(result.outcome);
      setRunFinishedAt(Date.now());
      lastContextRef.current = result.context ?? null;
      runOrderIdsRef.current = orderedIds;
      void persistFlowRun({ ...draft, steps: ordered }, result).catch((error) => {
        console.warn("Failed to persist flow run metadata:", error);
      });

      if (result.outcome === "pass") {
        toast.success("Flow completed successfully");
        setActiveTab("results");
      } else if (result.outcome === "fail") {
        toast.warning("Flow finished with failures");
        const bad = result.steps.find(
          (s) => s.outcome === "fail" || s.outcome === "error"
        );
        if (bad) {
          setActiveTab("builder");
          setFocusStepId(bad.stepId);
          requestAnimationFrame(() => {
            document.getElementById(`flow-step-${bad.stepId}`)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          });
        }
      } else {
        toast.error("Flow finished with errors");
        const bad = result.steps.find((s) => s.outcome === "error");
        if (bad) {
          setActiveTab("builder");
          setFocusStepId(bad.stepId);
          requestAnimationFrame(() => {
            document.getElementById(`flow-step-${bad.stepId}`)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          });
        }
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        toast.error("Flow run failed");
      }
      setRunFinishedAt(Date.now());
    } finally {
      setRunning(false);
      setRunningIndex(null);
      runningRef.current = false;
      abortRef.current = null;
    }
  }, [
    draft,
    endpoints,
    baseUrl,
    credentials,
    activeCredential,
    apiData,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!runningRef.current) void handleRun();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRun]);

  const resolvePause = useCallback(
    (action: PauseDecision["action"]) => {
      const resolver = pauseResolverRef.current;
      pauseResolverRef.current = null;
      const extraCaptures =
        action === "continue"
          ? pauseCaptures
              .filter((c) => c.name.trim() && c.path)
              .map((c) => ({
                name: c.name.trim(),
                source: "body" as const,
                path: c.path,
              }))
          : undefined;
      setPauseState(null);
      setPauseCaptures([]);
      resolver?.({ action, extraCaptures });
    },
    [pauseCaptures]
  );

  const handleCancel = () => {
    abortRef.current?.abort();
    if (pauseResolverRef.current) {
      pauseResolverRef.current({ action: "stop" });
      pauseResolverRef.current = null;
      setPauseState(null);
      setPauseCaptures([]);
    }
    setRunning(false);
    setRunningIndex(null);
  };

  const handleRunFromStep = useCallback(
    (stepId: string) => {
      void handleRun({ startStepId: stepId });
    },
    [handleRun]
  );

  const firstFailedStepId = useMemo(() => {
    const failed = runResults.find(
      (r) =>
        r != null &&
        (r.outcome === "fail" || r.outcome === "error")
    );
    return failed?.stepId ?? null;
  }, [runResults]);

  const focusStepInBuilder = (stepId: string) => {
    setFocusStepId(stepId);
    setSelectedStepId(stepId);
    setActiveTab("builder");
    requestAnimationFrame(() => {
      document.getElementById(`flow-step-${stepId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="shrink-0 z-20 bg-card border-b border-border">
        <div className="h-1 bg-primary w-full" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" asChild>
            <Link href={`/documentation/${specId}/playground`}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to playground</span>
            </Link>
          </Button>
          <div className="min-w-0 shrink max-w-md">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
              Flow tests
            </p>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate mt-0.5">
              {specTitle}
              {specVersion ? ` · v${specVersion}` : ""}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end min-w-0">
            <EnvironmentSwitcher
              specId={specId}
              specServers={apiData.servers}
              activeUrl={baseUrl}
              onActiveUrlChange={setBaseUrl}
              variant="navbar"
            />
            <div className="hidden sm:block h-6 w-px bg-border shrink-0" aria-hidden />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setTutorialOpen(true)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              How it works
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setFlowsDialogOpen(true)}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Saved flows
              <span className="text-muted-foreground">({savedFlows.length})</span>
            </Button>
            <TokenPanel
              specId={specId}
              activeCredential={activeCredential}
              onActiveChange={(c) => {
                setActiveCredential(c);
                refreshCredentials();
              }}
              variant="navbar"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSave}
              disabled={running || !dirty}
            >
              <Save className="h-3.5 w-3.5" />
              Save
              {dirty && <span className="text-primary">•</span>}
            </Button>
            {running ? (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleCancel}
              >
                <Square className="h-3.5 w-3.5" />
                Cancel
              </Button>
            ) : (
              <>
                {firstFailedStepId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() =>
                      void handleRun({ startStepId: firstFailedStepId })
                    }
                    title="Re-run from the first failed step, reusing earlier results"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Resume from failed
                  </Button>
                )}
                <Select
                  value={executionMode}
                  onValueChange={(v) =>
                    setDraft((prev) => ({
                      ...prev,
                      executionMode: v as FlowExecutionMode,
                      updatedAt: Date.now(),
                    }))
                  }
                  disabled={running}
                >
                  <SelectTrigger
                    className="h-8 w-[7.5rem] text-xs"
                    aria-label="Execution mode"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential</SelectItem>
                    <SelectItem value="parallel">Parallel</SelectItem>
                    <SelectItem value="conditional">Conditional</SelectItem>
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => void handleRun({ stepThrough: true })}
                        disabled={
                          draft.steps.length === 0 ||
                          executionMode === "parallel"
                        }
                      >
                        <StepForward className="h-3.5 w-3.5" />
                        Step through
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {executionMode === "parallel" && (
                    <TooltipContent side="bottom">
                      Not available in parallel mode
                    </TooltipContent>
                  )}
                </Tooltip>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => void handleRun()}
                  disabled={draft.steps.length === 0}
                  title="Run flow (Ctrl+Enter)"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run flow
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="shrink-0 border-b border-border px-4 flex items-center gap-3">
              <TabsList className="h-9">
                <TabsTrigger value="builder" className="text-xs gap-1">
                  <Workflow className="h-3.5 w-3.5" />
                  Builder
                </TabsTrigger>
                <TabsTrigger value="diagram" className="text-xs">
                  Diagram
                </TabsTrigger>
                <TabsTrigger value="results" className="text-xs">
                  Results
                  {running && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
                  {runOutcome && !running && (
                    <span
                      className={cn(
                        "ml-1 text-[10px]",
                        runOutcome === "pass" ? "text-success" : "text-destructive"
                      )}
                    >
                      ({runOutcome})
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="builder" className="flex-1 min-h-0 overflow-hidden m-0">
              <FlowBuilder
                flow={draft}
                endpoints={endpoints}
                credentials={credentials}
                apiData={apiData}
                baseUrl={baseUrl}
                runResults={runResults}
                runningIndex={runningIndex}
                selectedStepId={selectedStepId}
                focusStepId={focusStepId}
                onSelectStep={setSelectedStepId}
                onChange={setDraft}
              />
            </TabsContent>
            <TabsContent
              value="diagram"
              className="flex-1 min-h-0 overflow-hidden m-0 data-[state=inactive]:hidden"
            >
              <FlowDiagram
                flow={draft}
                endpoints={endpoints}
                apiData={apiData}
                baseUrl={baseUrl}
                credentials={credentials}
                results={runResults}
                runningIndex={runningIndex}
                visible={activeTab === "diagram"}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
                onRunFromStep={handleRunFromStep}
                onChange={setDraft}
              />
            </TabsContent>
            <TabsContent
              value="results"
              className="flex flex-col flex-1 min-h-0 overflow-hidden m-0 data-[state=inactive]:hidden"
            >
              <FlowResultsPanel
                results={runResults}
                runningIndex={runningIndex}
                startedAt={runStartedAt}
                finishedAt={runFinishedAt}
                executionMode={executionMode}
                onRunFromStep={handleRunFromStep}
                stepsById={stepsById}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <FlowTutorialDialog
        open={tutorialOpen}
        onOpenChange={handleTutorialOpenChange}
        canLoadSample={sampleFlowAvailable}
        onLoadSample={loadSampleFlow}
      />

      <Dialog open={flowsDialogOpen} onOpenChange={setFlowsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saved flows</DialogTitle>
            <DialogDescription>
              Open, duplicate, or delete a saved flow for this spec.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={newFlow}
            >
              <Plus className="h-3.5 w-3.5" />
              New flow
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={duplicateFlow}
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate draft
            </Button>
          </div>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {loadingFlows && (
              <p className="px-1 py-4 text-xs text-muted-foreground">Loading…</p>
            )}
            {!loadingFlows && savedFlows.length === 0 && (
              <p className="px-1 py-4 text-xs text-muted-foreground">
                No flows yet. Create one with New flow or save your draft.
              </p>
            )}
            {savedFlows.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "group flex items-start justify-between gap-1 rounded-md border px-2 py-2 cursor-pointer hover:bg-muted/50",
                  draft.id === f.id && "border-primary bg-primary/5"
                )}
                onClick={() => selectFlow(f)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {f.steps.length} step{f.steps.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(f.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pauseState}
        onOpenChange={(o) => {
          if (!o) resolvePause("stop");
        }}
      >
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-primary" />
              Paused after step {pauseState ? pauseState.index + 1 : ""} of{" "}
              {pauseState?.total}
            </DialogTitle>
            <DialogDescription>
              {pauseState && (
                <span className="font-mono text-xs">
                  {pauseState.method} {pauseState.path}
                </span>
              )}
              <br />
              Click fields in the live response to capture them, then continue.
            </DialogDescription>
          </DialogHeader>

          {pauseState && (
            <div className="space-y-3">
              <PayloadTreeView
                body={pauseState.payload.body}
                source={pauseState.payload.source}
                title="Live response"
                variant="panel"
                onPick={(path, preview) =>
                    setPauseCaptures((prev) =>
                      prev.some((c) => c.path === path)
                        ? prev
                        : [
                            ...prev,
                            { name: suggestVarName(path), path, preview },
                          ]
                    )
                }
              />

              {pauseCaptures.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Captures to apply ({pauseCaptures.length})
                  </Label>
                  {pauseCaptures.map((c, i) => (
                    <div key={c.path} className="flex items-center gap-1.5">
                      <Input
                        className="h-7 w-40 text-xs"
                        value={c.name}
                        aria-label="Variable name"
                        onChange={(e) =>
                          setPauseCaptures((prev) =>
                            prev.map((p, j) =>
                              j === i ? { ...p, name: e.target.value } : p
                            )
                          )
                        }
                      />
                      <code className="flex-1 truncate rounded bg-muted px-1.5 py-1 text-[11px] font-mono">
                        {c.path}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Remove capture"
                        onClick={() =>
                          setPauseCaptures((prev) =>
                            prev.filter((_, j) => j !== i)
                          )
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => resolvePause("stop")}
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop run
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => resolvePause("continue")}
                >
                  <Play className="h-3.5 w-3.5" />
                  Continue
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AiFloatingButton
        specId={specId}
        defaultBaseUrl={baseUrl}
        onApplyGeneratedFlow={applyGeneratedFlow}
      />
    </div>
  );
}
