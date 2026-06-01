"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MethodBadge } from "@/components/method-badge";
import { LiveJsonTree } from "@/components/playground/live-json-tree";
import { isJsonTreeValue } from "@/lib/playground/json-format";
import type { Extraction, FlowStep, StepRunResult } from "@/lib/flows/types";
import { cn } from "@/lib/utils";
import {
  Check,
  Copy,
  Loader2,
  MousePointerClick,
  Play,
} from "lucide-react";
import { toast } from "sonner";

type OutcomeBucket = StepRunResult["outcome"];

/** Desktop table column template: Step, Method, Path, Status, Latency, Role, Actions */
const TABLE_GRID_COLS =
  "grid-cols-[3rem_4.5rem_minmax(0,1fr)_minmax(5.5rem,auto)_4rem_minmax(4.5rem,auto)_4.5rem]";

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

const NOT_FOUND = "(not found)";

function defaultSelectedStepId(results: StepRunResult[]): string | null {
  if (results.length === 0) return null;
  const preferred =
    results.find((r) => r.outcome === "fail") ??
    results.find((r) => r.outcome === "error") ??
    results[0];
  return preferred?.stepId ?? null;
}

function sortedResults(results: StepRunResult[]): StepRunResult[] {
  return [...results].sort((a, b) => a.index - b.index);
}

function CaptureChip({
  name,
  value,
  extraction,
}: {
  name: string;
  value: string;
  extraction?: Extraction;
}) {
  const [copied, setCopied] = useState(false);
  const notFound = value === NOT_FOUND;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Copied ${name}`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const attempted = extraction
    ? extraction.source === "body"
      ? extraction.path
      : extraction.source === "headers"
        ? `header ${extraction.path}`
        : "status"
    : undefined;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-mono gap-1 pr-1 group/chip max-w-full",
        notFound && "border-destructive/40 text-destructive"
      )}
      title={
        notFound && attempted ? `No value at: ${attempted}` : undefined
      }
    >
      <span className="truncate">
        {name}={value}
        {notFound && attempted ? (
          <span className="opacity-70"> · {attempted}</span>
        ) : null}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-4 w-4 shrink-0 opacity-60 group-hover/chip:opacity-100"
        onClick={copy}
        title="Copy value"
      >
        {copied ? (
          <Check className="h-2.5 w-2.5 text-success" />
        ) : (
          <Copy className="h-2.5 w-2.5" />
        )}
      </Button>
    </Badge>
  );
}

function OutcomeBadge({
  row,
  isRunning,
}: {
  row: StepRunResult;
  isRunning: boolean;
}) {
  if (isRunning) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 whitespace-nowrap">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Running
      </Badge>
    );
  }
  const meta = outcomeMeta(row.outcome);
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] whitespace-nowrap", chipClass(meta.tone))}
    >
      {meta.label}
      {row.status > 0 ? ` · ${row.status}` : ""}
    </Badge>
  );
}

function ResultTableRow({
  row,
  selected,
  isRunning,
  onSelect,
  onRunFromStep,
}: {
  row: StepRunResult;
  selected: boolean;
  isRunning: boolean;
  onSelect: () => void;
  onRunFromStep?: (stepId: string) => void;
}) {
  const meta = outcomeMeta(row.outcome);
  const canResume =
    onRunFromStep && (row.outcome === "fail" || row.outcome === "error");

  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`Step ${row.index + 1}, ${row.method} ${row.path}`}
      className={cn(
        `grid ${TABLE_GRID_COLS} gap-x-2 items-center px-3 py-2 border-b border-border/60 text-sm cursor-pointer`,
        "hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        selected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
        meta.tone === "destructive" && !selected && "bg-destructive/[0.02]",
        meta.tone === "warning" && !selected && "bg-amber-500/[0.03]"
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {row.index + 1}
      </span>
      <MethodBadge method={row.method} className="shrink-0" />
      <span className="text-xs font-mono truncate min-w-0" title={row.path}>
        {row.path}
      </span>
      <OutcomeBadge row={row} isRunning={isRunning} />
      <span className="text-[11px] text-muted-foreground tabular-nums text-right">
        {row.latencyMs > 0 ? `${row.latencyMs}ms` : "—"}
      </span>
      <span
        className="text-[10px] text-muted-foreground truncate min-w-0"
        title={row.roleUsed}
      >
        {row.roleUsed ?? "—"}
      </span>
      <div
        className="flex justify-end"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {canResume ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Run flow from step ${row.index + 1}`}
            onClick={() => onRunFromStep(row.stepId)}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="h-7 w-7 block" aria-hidden />
        )}
      </div>
    </div>
  );
}

function ResultMobileCard({
  row,
  selected,
  isRunning,
  onSelect,
  onRunFromStep,
}: {
  row: StepRunResult;
  selected: boolean;
  isRunning: boolean;
  onSelect: () => void;
  onRunFromStep?: (stepId: string) => void;
}) {
  const meta = outcomeMeta(row.outcome);
  const canResume =
    onRunFromStep && (row.outcome === "fail" || row.outcome === "error");

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        selected && "ring-2 ring-primary border-primary/40",
        meta.tone === "destructive" && !selected && "border-destructive/25",
        meta.tone === "warning" && !selected && "border-amber-500/25"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left p-3 space-y-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
        aria-pressed={selected}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            Step {row.index + 1}
          </span>
          <OutcomeBadge row={row} isRunning={isRunning} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Method</dt>
          <dd>
            <MethodBadge method={row.method} />
          </dd>
          <dt className="text-muted-foreground">Path</dt>
          <dd className="font-mono truncate">{row.path}</dd>
          <dt className="text-muted-foreground">Latency</dt>
          <dd className="tabular-nums">
            {row.latencyMs > 0 ? `${row.latencyMs}ms` : "—"}
          </dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd className="truncate">{row.roleUsed ?? "—"}</dd>
        </dl>
        {row.error && (
          <p className="text-[11px] text-destructive line-clamp-2">{row.error}</p>
        )}
      </button>
      {canResume && (
        <div className="border-t border-border/60 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs"
            onClick={() => onRunFromStep(row.stepId)}
          >
            <Play className="h-3.5 w-3.5" />
            Run from here
          </Button>
        </div>
      )}
    </div>
  );
}

function ResultsTableGrid({
  rows,
  selectedStepId,
  runningIndex,
  onSelect,
  onRunFromStep,
}: {
  rows: StepRunResult[];
  selectedStepId: string | null;
  runningIndex?: number | null;
  onSelect: (stepId: string) => void;
  onRunFromStep?: (stepId: string) => void;
}) {
  return (
    <>
      {/* Desktop table */}
      <div
        className="hidden md:flex flex-col min-w-0 border border-border rounded-lg bg-card overflow-hidden"
        role="grid"
        aria-label="Flow step results"
      >
        <div
          role="row"
          className={cn(
            `grid ${TABLE_GRID_COLS} gap-x-2 items-center px-3 py-2 border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0`
          )}
        >
          <span role="columnheader">Step</span>
          <span role="columnheader">Method</span>
          <span role="columnheader">Path</span>
          <span role="columnheader">Status</span>
          <span role="columnheader" className="text-right">
            Time
          </span>
          <span role="columnheader">Role</span>
          <span role="columnheader" className="text-right">
            Actions
          </span>
        </div>
        <div className="overflow-y-auto max-h-[min(50vh,520px)] min-w-0">
          {rows.map((row) => (
            <ResultTableRow
              key={row.stepId}
              row={row}
              selected={selectedStepId === row.stepId}
              isRunning={runningIndex === row.index}
              onSelect={() => onSelect(row.stepId)}
              onRunFromStep={onRunFromStep}
            />
          ))}
        </div>
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <ResultMobileCard
            key={row.stepId}
            row={row}
            selected={selectedStepId === row.stepId}
            isRunning={runningIndex === row.index}
            onSelect={() => onSelect(row.stepId)}
            onRunFromStep={onRunFromStep}
          />
        ))}
      </div>
    </>
  );
}

function ResultDetailsPanel({
  row,
  stepsById,
  onRunFromStep,
}: {
  row: StepRunResult | null;
  stepsById?: Map<string, FlowStep>;
  onRunFromStep?: (stepId: string) => void;
}) {
  if (!row) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[200px] p-6 text-center">
        <MousePointerClick className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Select a row to view request and response details.
        </p>
      </div>
    );
  }

  const meta = outcomeMeta(row.outcome);
  const captureEntries = Object.entries(row.capturedVars);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-border px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            Step #{row.index + 1}
          </span>
          <MethodBadge method={row.method} />
          <span className="text-sm font-mono truncate flex-1 min-w-0">
            {row.path}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px]", chipClass(meta.tone))}>
            {meta.label}
            {row.status > 0 ? ` · ${row.status}` : ""}
          </Badge>
          {row.latencyMs > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {row.latencyMs}ms
            </span>
          )}
          {row.roleUsed && (
            <Badge variant="secondary" className="text-[10px]">
              {row.roleUsed}
            </Badge>
          )}
        </div>
        {row.error && (
          <p className="text-xs text-destructive">{row.error}</p>
        )}
        {onRunFromStep &&
          (row.outcome === "fail" || row.outcome === "error") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              aria-label={`Run flow from step ${row.index + 1}`}
              onClick={() => onRunFromStep(row.stepId)}
            >
              <Play className="h-3.5 w-3.5" />
              Run from here
            </Button>
          )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {captureEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
              Captures
            </p>
            <div className="flex flex-wrap gap-1">
              {captureEntries.map(([k, v]) => (
                <CaptureChip
                  key={k}
                  name={k}
                  value={v}
                  extraction={stepsById
                    ?.get(row.stepId)
                    ?.extractions.find((ex) => ex.name.trim() === k)}
                />
              ))}
            </div>
          </div>
        )}

        {row.resolvedUrl && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
              URL
            </p>
            <p className="text-xs font-mono break-all">{row.resolvedUrl}</p>
          </div>
        )}

        {row.requestPreview && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
              Request
            </p>
            <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto max-h-48">
              {row.requestPreview}
            </pre>
          </div>
        )}

        {row.outcome !== "skipped" && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
              Response
            </p>
            {isJsonTreeValue(row.responseBody) ? (
              <LiveJsonTree
                value={row.responseBody}
                variant="compact"
                hideRoot
              />
            ) : row.responseBodyPreview ? (
              <pre className="text-xs font-mono bg-muted/50 rounded-lg border border-border p-2 overflow-x-auto max-h-[min(40vh,320px)] whitespace-pre-wrap break-words">
                {row.responseBodyPreview}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No response body
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type FlowResultsPanelProps = {
  results: StepRunResult[];
  runningIndex?: number | null;
  startedAt?: number;
  finishedAt?: number;
  onRunFromStep?: (stepId: string) => void;
  stepsById?: Map<string, FlowStep>;
};

export function FlowResultsPanel({
  results,
  runningIndex,
  startedAt,
  finishedAt,
  onRunFromStep,
  stepsById,
}: FlowResultsPanelProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const rows = useMemo(() => sortedResults(results), [results]);

  const selectedRow = useMemo(
    () => results.find((r) => r.stepId === selectedStepId) ?? null,
    [results, selectedStepId]
  );

  useEffect(() => {
    if (results.length === 0) {
      setSelectedStepId(null);
      return;
    }
    setSelectedStepId((prev) => {
      if (prev && results.some((r) => r.stepId === prev)) return prev;
      return defaultSelectedStepId(results);
    });
  }, [results]);

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-4 py-8 text-center">
        Run a flow to see step results here.
      </p>
    );
  }

  const passed = results.filter((r) => r.outcome === "pass").length;
  const failed = results.filter((r) => r.outcome === "fail").length;
  const errored = results.filter((r) => r.outcome === "error").length;
  const skipped = results.filter((r) => r.outcome === "skipped").length;
  const totalMs =
    startedAt != null && finishedAt != null && finishedAt > startedAt
      ? finishedAt - startedAt
      : results.reduce((sum, r) => sum + r.latencyMs, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-b border-border px-4 py-3">
        <span className="text-success font-medium">{passed} passed</span>
        {failed > 0 && (
          <span className="text-destructive font-medium">{failed} failed</span>
        )}
        {errored > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {errored} error
          </span>
        )}
        {skipped > 0 && <span>{skipped} skipped</span>}
        {runningIndex != null && (
          <span className="text-primary animate-pulse">Running…</span>
        )}
        {totalMs > 0 && (
          <span className="tabular-nums ml-auto">{totalMs}ms total</span>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 min-w-0">
          <ResultsTableGrid
            rows={rows}
            selectedStepId={selectedStepId}
            runningIndex={runningIndex}
            onSelect={setSelectedStepId}
            onRunFromStep={onRunFromStep}
          />
        </div>

        <aside
          className="w-full lg:w-[min(420px,42%)] lg:max-w-md shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card/50 min-h-[240px] lg:min-h-0 flex flex-col"
          aria-label="Step details"
        >
          <ResultDetailsPanel
            row={selectedRow}
            stepsById={stepsById}
            onRunFromStep={onRunFromStep}
          />
        </aside>
      </div>
    </div>
  );
}
