"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  Loader2,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/method-badge";
import { FlowStepCard } from "@/components/playground/flow-step-card";
import { LiveJsonTree } from "@/components/playground/live-json-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { setFlowLoginStep, stepRoleLabel } from "@/lib/flows/auth-helpers";
import {
  linearConnections,
  orderSteps,
  pruneConnections,
} from "@/lib/flows/order";
import { flowEndpointKey } from "@/lib/flows/types";
import type { Flow, FlowStep, StepRunResult } from "@/lib/flows/types";
import type { FlowApiData } from "@/lib/flows/step-defaults";
import type { Credential } from "@/lib/playground/credentials";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { isJsonTreeValue } from "@/lib/playground/json-format";
import { cn } from "@/lib/utils";

type OutcomeBucket = StepRunResult["outcome"];

function outcomeMeta(outcome: OutcomeBucket): {
  label: string;
  tone: "success" | "destructive" | "warning" | "muted";
} {
  switch (outcome) {
    case "pass":
      return { label: "Pass", tone: "success" };
    case "fail":
      return { label: "Fail", tone: "destructive" };
    case "error":
      return { label: "Error", tone: "warning" };
    default:
      return { label: "Skipped", tone: "muted" };
  }
}

function chipClass(tone: "success" | "destructive" | "warning" | "muted"): string {
  switch (tone) {
    case "success":
      return "bg-success/15 text-success border-success/30";
    case "destructive":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "warning":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function accentBorder(tone: "success" | "destructive" | "warning" | "muted" | null): string {
  switch (tone) {
    case "success":
      return "border-l-success";
    case "destructive":
      return "border-l-destructive";
    case "warning":
      return "border-l-amber-500";
    case "muted":
      return "border-l-muted-foreground/40";
    default:
      return "border-l-border";
  }
}

function InspectorSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card/50">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 rounded-lg">
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{title}</p>
          {subtitle ? (
            <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
          ) : null}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-3 pb-3 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function LastRunSection({
  result,
  step,
}: {
  result: StepRunResult;
  step: FlowStep;
}) {
  const meta = outcomeMeta(result.outcome);
  const captureEntries = Object.entries(result.capturedVars);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("text-[10px]", chipClass(meta.tone))}>
          {meta.label}
          {result.status > 0 ? ` · ${result.status}` : ""}
        </Badge>
        {result.latencyMs > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {result.latencyMs}ms
          </span>
        )}
        {result.roleUsed && (
          <Badge variant="secondary" className="text-[10px]">
            {result.roleUsed}
          </Badge>
        )}
      </div>

      {result.error && (
        <p className="text-xs text-destructive break-words">{result.error}</p>
      )}

      {captureEntries.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
            Captures
          </p>
          <div className="flex flex-wrap gap-1">
            {captureEntries.map(([k, v]) => (
              <Badge
                key={k}
                variant="outline"
                className="text-[10px] font-mono max-w-full truncate"
              >
                {k}={v}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {result.resolvedUrl && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
            URL
          </p>
          <p className="text-xs font-mono break-all text-foreground/90">
            {result.resolvedUrl}
          </p>
        </div>
      )}

      {result.requestPreview && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
            Request
          </p>
          <pre className="text-xs font-mono bg-muted/50 rounded-md border border-border/60 p-2 overflow-x-auto max-h-36 whitespace-pre-wrap break-words">
            {result.requestPreview}
          </pre>
        </div>
      )}

      {result.outcome !== "skipped" && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
            Response
          </p>
          {isJsonTreeValue(result.responseBody) ? (
            <div className="rounded-md border border-border/60 overflow-hidden">
              <LiveJsonTree
                value={result.responseBody}
                variant="compact"
                hideRoot
              />
            </div>
          ) : result.responseBodyPreview ? (
            <pre className="text-xs font-mono bg-muted/50 rounded-md border border-border/60 p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
              {result.responseBodyPreview}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground italic">No response body</p>
          )}
        </div>
      )}

      {step.extractions.length > 0 && captureEntries.length === 0 && result.outcome !== "skipped" && (
        <p className="text-[10px] text-muted-foreground">
          No captures saved from this run. Check capture paths in Configuration.
        </p>
      )}
    </div>
  );
}

export type FlowStepInspectorProps = {
  flow: Flow;
  endpoints: PlaygroundEndpoint[];
  apiData: FlowApiData;
  baseUrl: string;
  credentials: Credential[];
  selectedStepId: string | null;
  resultByStepId: Map<string, StepRunResult>;
  runningIndex?: number | null;
  onChange: (flow: Flow) => void;
  onClose: () => void;
  onRunFromStep?: (stepId: string) => void;
};

export function FlowStepInspector({
  flow,
  endpoints,
  apiData,
  baseUrl,
  credentials,
  selectedStepId,
  resultByStepId,
  runningIndex,
  onChange,
  onClose,
  onRunFromStep,
}: FlowStepInspectorProps) {
  const ordered = useMemo(() => orderSteps(flow), [flow]);
  const orderedIndex = ordered.findIndex((s) => s.id === selectedStepId);
  const open = selectedStepId != null && orderedIndex >= 0;

  const step = open ? ordered[orderedIndex] : null;
  const realIndex = step
    ? flow.steps.findIndex((s) => s.id === selectedStepId)
    : -1;

  const endpoint = step
    ? endpoints.find((e) => flowEndpointKey(e) === step.endpointKey)
    : undefined;

  const selectedResult = step ? resultByStepId.get(step.id) : undefined;
  const isRunning = runningIndex === orderedIndex;

  const {
    label: roleLabel,
    isLogin: isLoginStep,
    usesLoginToken,
  } = useMemo(
    () => (step ? stepRoleLabel(step, flow.auth) : { label: "", isLogin: false, usesLoginToken: false }),
    [step, flow.auth]
  );

  const captureCount = step
    ? step.extractions.filter((e) => e.name.trim()).length
    : 0;

  const outcomeTone = selectedResult
    ? outcomeMeta(selectedResult.outcome).tone
    : null;

  const updateStep = (next: FlowStep) => {
    if (realIndex < 0) return;
    const steps = [...flow.steps];
    steps[realIndex] = next;
    onChange({ ...flow, steps });
  };

  const removeStep = () => {
    if (!selectedStepId) return;
    const steps = flow.steps.filter((s) => s.id !== selectedStepId);
    const base = flow.connections ?? linearConnections(flow.steps);
    const connections = pruneConnections(base, new Set(steps.map((s) => s.id)));
    const positions = { ...(flow.diagramPositions ?? {}) };
    delete positions[selectedStepId];
    onChange({ ...flow, steps, connections, diagramPositions: positions });
    onClose();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const pathLabel = endpoint?.path ?? step?.endpointKey ?? "";
  const methodLabel = endpoint?.method ?? "—";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full w-[520px] max-w-[92vw] flex-col gap-0 p-0 sm:max-w-[520px]",
          "border-l shadow-xl",
          accentBorder(outcomeTone),
          "border-l-4"
        )}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest(".react-flow")) {
            e.preventDefault();
          }
        }}
      >
        {step && (
          <>
            <SheetHeader
              className={cn(
                "shrink-0 space-y-2 border-b border-border px-4 py-4 pr-12 text-left",
                isRunning && "bg-primary/5"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  Step {orderedIndex + 1}
                </Badge>
                {isRunning && (
                  <Badge variant="outline" className="gap-1 text-[10px] border-primary/40">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running
                  </Badge>
                )}
                {selectedResult && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      chipClass(outcomeMeta(selectedResult.outcome).tone)
                    )}
                  >
                    {outcomeMeta(selectedResult.outcome).label}
                    {selectedResult.status > 0 ? ` · ${selectedResult.status}` : ""}
                  </Badge>
                )}
                {selectedResult && selectedResult.latencyMs > 0 && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {selectedResult.latencyMs}ms
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2 min-w-0">
                <MethodBadge method={methodLabel} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SheetTitle className="text-sm font-mono font-medium leading-snug truncate flex-1 min-w-0">
                      {pathLabel}
                    </SheetTitle>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md font-mono text-xs">
                    {pathLabel}
                  </TooltipContent>
                </Tooltip>
              </div>

              <SheetDescription className="sr-only">
                Configure step {orderedIndex + 1}: {methodLabel} {pathLabel}
              </SheetDescription>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px]",
                    isLoginStep && "border-primary/40 bg-primary/10",
                    usesLoginToken && "border-success/40 bg-success/10"
                  )}
                >
                  {roleLabel}
                </Badge>
                {captureCount > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {captureCount} capture{captureCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {selectedResult && (
                <InspectorSection
                  title="Last run"
                  subtitle={
                    selectedResult.status > 0
                      ? `HTTP ${selectedResult.status}`
                      : selectedResult.outcome
                  }
                  defaultOpen
                >
                  <LastRunSection result={selectedResult} step={step} />
                </InspectorSection>
              )}

              <InspectorSection
                title="Configuration"
                subtitle="Auth, request, and captures"
                defaultOpen
              >
                <FlowStepCard
                  embedded
                  step={step}
                  index={orderedIndex}
                  endpoints={endpoints}
                  apiData={apiData}
                  baseUrl={baseUrl}
                  priorSteps={ordered.slice(0, orderedIndex)}
                  credentials={credentials}
                  flowAuth={flow.auth}
                  open
                  onOpenChange={() => {}}
                  selected
                  canMoveUp={false}
                  canMoveDown={false}
                  runResult={selectedResult}
                  resultsByStepId={resultByStepId}
                  isRunning={isRunning}
                  onChange={updateStep}
                  onRemove={removeStep}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                />
              </InspectorSection>
            </div>

            <SheetFooter className="shrink-0 flex-row flex-wrap gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:justify-between">
              {onRunFromStep && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onRunFromStep(step.id)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run from here
                </Button>
              )}
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    onChange(setFlowLoginStep(flow, step.id));
                    toast.success("This step is now the flow login");
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Use as login
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={removeStep}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete step
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
