"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MethodBadge } from "@/components/method-badge";
import { LiveJsonTree } from "@/components/playground/live-json-tree";
import { isJsonTreeValue } from "@/lib/playground/json-format";
import type {
  Extraction,
  FlowExecutionMode,
  FlowStep,
  StepRunResult,
} from "@/lib/flows/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  Clock3,
  Copy,
  Link2,
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

function DetailStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-medium tabular-nums",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CopyTextButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-[11px]"
      onClick={copy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}

function DetailSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
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
  const canResume =
    onRunFromStep && (row.outcome === "fail" || row.outcome === "error");
  const statusTone =
    meta.tone === "success"
      ? "success"
      : meta.tone === "destructive"
        ? "destructive"
        : meta.tone === "warning"
          ? "warning"
          : undefined;

  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/15">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="h-6 text-[11px]">
                Step {row.index + 1}
              </Badge>
              <MethodBadge method={row.method} />
              <Badge
                variant="outline"
                className={cn("h-6 text-[11px]", chipClass(meta.tone))}
              >
                {meta.label}
              </Badge>
            </div>
            <h3
              className="text-sm font-semibold leading-snug truncate"
              title={row.stepName || row.path}
            >
              {row.stepName || row.path}
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {row.method} {row.path}
            </p>
          </div>
          {canResume && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs"
              aria-label={`Run flow from step ${row.index + 1}`}
              onClick={() => onRunFromStep(row.stepId)}
            >
              <Play className="h-3.5 w-3.5" />
              Run from here
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <DetailStat
            label="Status"
            value={row.status > 0 ? String(row.status) : meta.label}
            tone={statusTone}
          />
          <DetailStat
            label="Latency"
            value={row.latencyMs > 0 ? `${row.latencyMs}ms` : "—"}
          />
          <DetailStat label="Role" value={row.roleUsed ?? "—"} />
          <DetailStat
            label="Captures"
            value={String(captureEntries.length)}
            tone={captureEntries.length > 0 ? "success" : undefined}
          />
        </div>

        {row.error && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Step issue
            </div>
            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
              {row.error}
            </p>
          </div>
        )}

        {captureEntries.length > 0 && (
          <DetailSection title="Captured variables">
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
          </DetailSection>
        )}

        {row.resolvedUrl && (
          <DetailSection
            title="Resolved URL"
            action={<CopyTextButton value={row.resolvedUrl} label="Copy URL" />}
          >
            <div className="flex gap-2 rounded-lg bg-muted/50 p-2">
              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="min-w-0 break-all font-mono text-xs leading-relaxed">
                {row.resolvedUrl}
              </p>
            </div>
          </DetailSection>
        )}

        {row.requestPreview && (
          <DetailSection
            title="Request"
            action={<CopyTextButton value={row.requestPreview} label="Copy" />}
          >
            <pre className="max-h-56 overflow-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
              {row.requestPreview}
            </pre>
          </DetailSection>
        )}

        {row.outcome !== "skipped" && (
          <DetailSection title="Response">
            {isJsonTreeValue(row.responseBody) ? (
              <LiveJsonTree
                value={row.responseBody}
                variant="compact"
                hideRoot
              />
            ) : row.responseBodyPreview ? (
              <pre className="max-h-[min(45vh,420px)] overflow-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                {row.responseBodyPreview}
              </pre>
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground italic">
                <Clock3 className="h-3.5 w-3.5" />
                No response body
              </p>
            )}
          </DetailSection>
        )}
      </div>
    </div>
  );
}

const MODE_LABELS: Record<FlowExecutionMode, string> = {
  sequential: "Sequential",
  parallel: "Parallel",
  conditional: "Conditional",
};

const DETAIL_WIDTH_STORAGE_KEY = "flow_results_detail_panel_width";
const DETAIL_WIDTH_DEFAULT = 520;
const DETAIL_WIDTH_MIN = 360;
const LIST_WIDTH_MIN = 280;
const DETAIL_WIDTH_MAX_RATIO = 0.7;
const RESIZE_STEP_PX = 12;
const LG_BREAKPOINT_PX = 1024;

function loadDetailPanelWidth(): number {
  if (typeof window === "undefined") return DETAIL_WIDTH_DEFAULT;
  try {
    const raw = localStorage.getItem(DETAIL_WIDTH_STORAGE_KEY);
    if (!raw) return DETAIL_WIDTH_DEFAULT;
    const w = Number(raw);
    if (!Number.isFinite(w)) return DETAIL_WIDTH_DEFAULT;
    return Math.max(DETAIL_WIDTH_MIN, w);
  } catch {
    return DETAIL_WIDTH_DEFAULT;
  }
}

function saveDetailPanelWidth(width: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DETAIL_WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    /* quota */
  }
}

function clampDetailWidth(width: number, containerWidth: number): number {
  if (containerWidth <= 0) {
    return Math.max(DETAIL_WIDTH_MIN, width);
  }
  const maxByRatio = containerWidth * DETAIL_WIDTH_MAX_RATIO;
  const maxByList = containerWidth - LIST_WIDTH_MIN - 12;
  const max = Math.max(
    DETAIL_WIDTH_MIN,
    Math.min(maxByRatio, maxByList > DETAIL_WIDTH_MIN ? maxByList : maxByRatio)
  );
  return Math.min(max, Math.max(DETAIL_WIDTH_MIN, width));
}

type FlowResultsPanelProps = {
  results: StepRunResult[];
  runningIndex?: number | null;
  startedAt?: number;
  finishedAt?: number;
  executionMode?: FlowExecutionMode;
  onRunFromStep?: (stepId: string) => void;
  stepsById?: Map<string, FlowStep>;
};

export function FlowResultsPanel({
  results,
  runningIndex,
  startedAt,
  finishedAt,
  executionMode = "sequential",
  onRunFromStep,
  stepsById,
}: FlowResultsPanelProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [detailPanelWidth, setDetailPanelWidth] = useState(() =>
    loadDetailPanelWidth()
  );
  const [splitContainerWidth, setSplitContainerWidth] = useState(0);
  const splitRef = useRef<HTMLDivElement>(null);
  const saveWidthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const isSplitResizable =
    splitContainerWidth >= LG_BREAKPOINT_PX && splitContainerWidth > 0;

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

  useEffect(() => {
    const el = splitRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setSplitContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isSplitResizable) return;
    setDetailPanelWidth((prev) => clampDetailWidth(prev, splitContainerWidth));
  }, [splitContainerWidth, isSplitResizable]);

  const scheduleSaveWidth = useCallback((width: number) => {
    if (saveWidthTimerRef.current) clearTimeout(saveWidthTimerRef.current);
    saveWidthTimerRef.current = setTimeout(() => {
      saveDetailPanelWidth(width);
    }, 200);
  }, []);

  const setDetailWidthClamped = useCallback(
    (next: number) => {
      const clamped = clampDetailWidth(next, splitContainerWidth);
      setDetailPanelWidth(clamped);
      scheduleSaveWidth(clamped);
    },
    [splitContainerWidth, scheduleSaveWidth]
  );

  const onSplitResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isSplitResizable) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: detailPanelWidth };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startX - ev.clientX;
        setDetailWidthClamped(dragRef.current.startWidth + delta);
      };

      const onUp = (ev: PointerEvent) => {
        dragRef.current = null;
        target.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [detailPanelWidth, isSplitResizable, setDetailWidthClamped]
  );

  const onSplitResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isSplitResizable) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setDetailWidthClamped(detailPanelWidth + RESIZE_STEP_PX);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setDetailWidthClamped(detailPanelWidth - RESIZE_STEP_PX);
      } else if (e.key === "Home" || e.key === "Enter") {
        e.preventDefault();
        setDetailWidthClamped(DETAIL_WIDTH_DEFAULT);
      } else if (e.key === "End") {
        e.preventDefault();
        setDetailWidthClamped(
          clampDetailWidth(splitContainerWidth, splitContainerWidth)
        );
      }
    },
    [detailPanelWidth, isSplitResizable, setDetailWidthClamped, splitContainerWidth]
  );

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
        <Badge variant="outline" className="text-[10px] h-5 font-normal capitalize">
          {MODE_LABELS[executionMode]}
        </Badge>
        {executionMode === "parallel" && (
          <span className="text-[10px] text-muted-foreground">
            Steps ran concurrently
          </span>
        )}
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

      <div
        ref={splitRef}
        className="flex flex-1 min-h-0 flex-col lg:flex-row"
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-4 min-w-0 lg:min-w-[200px]">
          <ResultsTableGrid
            rows={rows}
            selectedStepId={selectedStepId}
            runningIndex={runningIndex}
            onSelect={setSelectedStepId}
            onRunFromStep={onRunFromStep}
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(detailPanelWidth)}
          aria-valuemin={DETAIL_WIDTH_MIN}
          aria-valuemax={Math.round(
            clampDetailWidth(splitContainerWidth, splitContainerWidth)
          )}
          aria-label="Resize step details panel"
          tabIndex={isSplitResizable ? 0 : -1}
          className={cn(
            "group hidden lg:flex shrink-0 w-2 touch-none cursor-col-resize items-center justify-center",
            "bg-border/40 hover:bg-primary/25 focus-visible:bg-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
            isSplitResizable ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onPointerDown={onSplitResizePointerDown}
          onKeyDown={onSplitResizeKeyDown}
        >
          <div
            className="w-0.5 h-10 rounded-full bg-border/80 group-hover:bg-primary/60 group-focus-visible:bg-primary/70"
            aria-hidden
          />
        </div>

        <aside
          className={cn(
            "w-full shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card/50",
            "min-h-[320px] lg:min-h-0 flex flex-col"
          )}
          style={
            isSplitResizable
              ? { width: detailPanelWidth, maxWidth: "100%" }
              : undefined
          }
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
