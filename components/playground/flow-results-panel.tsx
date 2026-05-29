"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MethodBadge } from "@/components/method-badge";
import { LiveJsonTree } from "@/components/playground/live-json-tree";
import { isJsonTreeValue } from "@/lib/playground/json-format";
import type { Extraction, FlowStep, StepRunResult } from "@/lib/flows/types";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, Copy, Play } from "lucide-react";
import { toast } from "sonner";

function outcomeMeta(outcome: StepRunResult["outcome"]): {
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
        notFound && attempted
          ? `No value at: ${attempted}`
          : undefined
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

type FlowResultsPanelProps = {
  results: StepRunResult[];
  runningIndex?: number | null;
  startedAt?: number;
  finishedAt?: number;
  onRunFromStep?: (stepId: string) => void;
  /** Step definitions by id, used to show the attempted path on failed captures. */
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
    <div className="flex flex-col gap-2 p-4 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-b border-border pb-3 mb-1">
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

      {results.map((row) => {
        const meta = outcomeMeta(row.outcome);
        const isRunning = runningIndex === row.index;
        const displayMeta = isRunning
          ? { label: "Running…", tone: "muted" as const }
          : meta;

        return (
          <Collapsible
            key={row.stepId}
            defaultOpen={row.outcome !== "pass" && row.outcome !== "skipped"}
          >
            <div
              className={cn(
                "rounded-lg border border-border bg-card border-l-4",
                displayMeta.tone === "success" && "border-l-success",
                displayMeta.tone === "destructive" && "border-l-destructive",
                displayMeta.tone === "warning" && "border-l-amber-500",
                displayMeta.tone === "muted" && "border-l-muted-foreground/30"
              )}
            >
              <div className="flex items-start gap-3 p-3">
                <CollapsibleTrigger className="flex flex-1 min-w-0 items-start gap-3 -m-1 p-1 text-left hover:bg-muted/40 rounded-lg">
                  <span className="mt-1 text-muted-foreground">
                    <ChevronRight className="h-4 w-4 [[data-state=open]_&]:hidden" />
                    <ChevronDown className="h-4 w-4 hidden [[data-state=open]_&]:block" />
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        #{row.index + 1}
                      </span>
                      <MethodBadge method={row.method} />
                      <span className="text-sm font-mono truncate">
                        {row.path}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          chipClass(displayMeta.tone)
                        )}
                      >
                        {displayMeta.label}
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
                  </div>
                </CollapsibleTrigger>
                {onRunFromStep &&
                  (row.outcome === "fail" || row.outcome === "error") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1 text-[11px]"
                      aria-label={`Run flow from step ${row.index + 1} (${row.method} ${row.path})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunFromStep(row.stepId);
                      }}
                    >
                      <Play className="h-3 w-3" />
                      Run from here
                    </Button>
                  )}
              </div>
              {Object.keys(row.capturedVars).length > 0 && (
                <div className="flex flex-wrap gap-1 px-3 pb-3 pl-10">
                  {Object.entries(row.capturedVars).map(([k, v]) => (
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
              )}
              <CollapsibleContent className="px-3 pb-3 pt-0 space-y-2 border-t border-border/60 mx-3">
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
                    <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto max-h-40">
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
                      <pre className="text-xs font-mono bg-muted/50 rounded-lg border border-border p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                        {row.responseBodyPreview}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No response body
                      </p>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
