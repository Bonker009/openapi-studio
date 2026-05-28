"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MethodBadge } from "@/components/method-badge";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import type { ValidationResult } from "@/lib/validation/types";
import { cn } from "@/lib/utils";

function outcomeMeta(result: ValidationResult): {
  label: string;
  hint: string;
  tone: "success" | "destructive" | "warning" | "muted";
} {
  if (result.category === "baseline") {
    if (result.ok) {
      return {
        label: result.status > 0 ? String(result.status) : "OK",
        hint: "Baseline valid request succeeded",
        tone: "success",
      };
    }
    return {
      label: result.status > 0 ? String(result.status) : "Fail",
      hint: "Baseline should return 2xx — check overrides",
      tone: "warning",
    };
  }
  if (result.ok) {
    return {
      label: result.status > 0 ? String(result.status) : "Rejected",
      hint: "Server rejected invalid input (expected)",
      tone: "success",
    };
  }
  if (result.outcome === "error") {
    return {
      label: result.status > 0 ? String(result.status) : "Error",
      hint: "5xx or network error",
      tone: "warning",
    };
  }
  return {
    label: result.status > 0 ? String(result.status) : "Accepted",
    hint: "Server accepted bad input (unexpected)",
    tone: "destructive",
  };
}

function borderAccent(tone: "success" | "destructive" | "warning" | "muted"): string {
  switch (tone) {
    case "success":
      return "border-l-success";
    case "destructive":
      return "border-l-destructive";
    case "warning":
      return "border-l-amber-500";
    default:
      return "border-l-muted-foreground/30";
  }
}

function chipClass(tone: "success" | "destructive" | "warning" | "muted"): string {
  switch (tone) {
    case "success":
      return "bg-success/15 text-success border-success/30";
    case "destructive":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "warning":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function OutcomeIcon({
  result,
  tone,
}: {
  result: ValidationResult;
  tone: "success" | "destructive" | "warning" | "muted";
}) {
  if (tone === "success") return <Check className="size-3 shrink-0" aria-hidden />;
  if (tone === "warning")
    return <AlertTriangle className="size-3 shrink-0" aria-hidden />;
  return <X className="size-3 shrink-0" aria-hidden />;
}

type ValidationResultRowProps = {
  result: ValidationResult;
  endpoint?: PlaygroundEndpoint;
  specId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerun?: () => void;
  running?: boolean;
  compact?: boolean;
};

export function ValidationResultRow({
  result,
  endpoint,
  specId,
  open,
  onOpenChange,
  onRerun,
  running,
  compact,
}: ValidationResultRowProps) {
  const meta = outcomeMeta(result);

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          "rounded-md border border-l-4 bg-background text-sm",
          borderAccent(meta.tone),
          meta.tone === "destructive" && "bg-destructive/[0.03]"
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/50 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {compact ? (
            <MethodBadge method={result.method} className="shrink-0 text-[9px] h-4" />
          ) : null}
          <Badge variant="outline" className="text-[10px] shrink-0 font-normal capitalize">
            {result.category}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-tight">{result.name}</p>
            {compact ? (
              <p className="truncate text-[10px] text-muted-foreground font-mono">
                {result.path} · {result.fieldPath}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <Badge
              variant="outline"
              className={cn(
                "gap-1 tabular-nums text-xs font-semibold",
                chipClass(meta.tone)
              )}
              title={meta.hint}
            >
              <OutcomeIcon result={result} tone={meta.tone} />
              {meta.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {result.latencyMs}ms
            </span>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t px-3 py-3 text-xs">
            <p className="text-muted-foreground">{meta.hint}</p>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <span>
                Field: <code className="text-foreground font-mono">{result.fieldPath}</code>
              </span>
              <span>
                Variant: <code className="text-foreground font-mono">{result.variant}</code>
              </span>
            </div>

            {result.requestPreview ? (
              <div>
                <p className="mb-1 font-medium text-muted-foreground">Request</p>
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-2 font-mono text-[11px]">
                  {result.requestPreview}
                </pre>
              </div>
            ) : null}

            {result.error ? (
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-destructive/10 p-2 text-destructive text-[11px]">
                {result.error}
              </pre>
            ) : null}

            {result.responseBodyPreview ? (
              <div>
                <p className="mb-1 font-medium text-muted-foreground">Response</p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-2 font-mono text-[11px]">
                  {result.responseBodyPreview}
                </pre>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {onRerun ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={running}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRerun();
                  }}
                >
                  Rerun
                </Button>
              ) : null}
              {endpoint ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link
                    href={`/documentation/${specId}/playground?method=${encodeURIComponent(endpoint.method)}&path=${encodeURIComponent(endpoint.path)}`}
                  >
                    <ExternalLink className="size-3 mr-1" aria-hidden />
                    Open in playground
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ValidationEndpointHeader({
  method,
  path,
  passed,
  total,
}: {
  method: string;
  path: string;
  passed: number;
  total: number;
}) {
  const failed = total - passed;
  return (
    <div className="flex items-center gap-2 mb-2">
      <MethodBadge method={method} className="text-xs shrink-0" />
      <span className="font-mono text-xs truncate flex-1">{path}</span>
      <Badge
        variant="outline"
        className={cn(
          "tabular-nums text-xs shrink-0",
          failed > 0 ? "text-destructive border-destructive/40" : "text-success"
        )}
      >
        {passed}/{total}
      </Badge>
    </div>
  );
}
