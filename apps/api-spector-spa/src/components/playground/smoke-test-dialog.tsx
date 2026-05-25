"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FlaskConical,
  Minus,
  Settings2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MethodBadge } from "@/components/method-badge";
import type { Credential } from "@/lib/playground/credentials";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import {
  runSmokeTests,
  smokeAggregate,
  smokeOneEndpoint,
  type SmokeResult,
} from "@/lib/playground/smoke-runner";
import { downloadExcelWorkbook } from "@/lib/export-excel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SmokeTestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specId: string;
  endpoints: PlaygroundEndpoint[];
  workingPaths?: Set<string>;
  baseUrl: string;
  credential: Credential | null;
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
  };
};

function resultKey(r: SmokeResult) {
  return `${r.method}:${r.path}`;
}

function exportFilename(specId: string, ext: "csv" | "json" | "xlsx") {
  const date = new Date().toISOString().slice(0, 10);
  return `smoke-${specId}-${date}.${ext}`;
}

const SMOKE_COLUMNS = [
  { id: "method", label: "Method" },
  { id: "path", label: "Path" },
  { id: "controller", label: "Tag" },
  { id: "status", label: "Status" },
  { id: "latencyMs", label: "Latency (ms)" },
  { id: "ok", label: "OK" },
  { id: "skipped", label: "Skipped" },
  { id: "error", label: "Error" },
];

function resultsToRows(results: SmokeResult[]): Record<string, unknown>[] {
  return results.map((r) => ({
    method: r.method,
    path: r.path,
    controller: r.controller,
    status: r.status,
    latencyMs: r.latencyMs,
    ok: r.ok ? "Yes" : "No",
    skipped: r.skipped ? "Yes" : "No",
    error: r.error ?? "",
  }));
}

function resultsToCsv(results: SmokeResult[]): string {
  const escape = (v: string | number | boolean) =>
    `"${String(v).replace(/"/g, '""')}"`;
  const header =
    "method,path,controller,status,latency_ms,ok,skipped,error";
  const rows = results.map((r) =>
    [
      r.method,
      r.path,
      r.controller,
      r.status,
      r.latencyMs,
      r.ok,
      r.skipped ?? "",
      r.error ?? "",
    ]
      .map(escape)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusOutcomeIcon({ result }: { result: SmokeResult }) {
  if (result.skipped) {
    return <Minus className="size-3 shrink-0" aria-hidden />;
  }
  if (result.ok) {
    return <Check className="size-3 shrink-0" aria-hidden />;
  }
  return <X className="size-3 shrink-0" aria-hidden />;
}

function statusChipClass(result: SmokeResult): string {
  if (result.skipped) return "bg-muted text-muted-foreground";
  if (result.ok) return "bg-success/15 text-success";
  return "bg-destructive/15 text-destructive";
}

function SmokeConfigPopover({
  concurrency,
  onConcurrencyChange,
  includeSkippedInFailed,
  onIncludeSkippedInFailedChange,
  disabled,
}: {
  concurrency: number;
  onConcurrencyChange: (n: number) => void;
  includeSkippedInFailed: boolean;
  onIncludeSkippedInFailedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label="Smoke test settings"
        >
          <Settings2 className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="smoke-concurrency">Concurrency</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {concurrency}
              </span>
            </div>
            <input
              id="smoke-concurrency"
              type="range"
              min={1}
              max={8}
              step={1}
              value={concurrency}
              onChange={(e) => onConcurrencyChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="smoke-include-skipped"
              checked={includeSkippedInFailed}
              onCheckedChange={(v) =>
                onIncludeSkippedInFailedChange(v === true)
              }
            />
            <Label
              htmlFor="smoke-include-skipped"
              className="text-sm leading-snug font-normal"
            >
              Include skipped in failed view
            </Label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SmokeExportMenu({
  results,
  specId,
  disabled,
}: {
  results: SmokeResult[];
  specId: string;
  disabled?: boolean;
}) {
  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
  };

  const handleDownloadCsv = () => {
    downloadText(
      resultsToCsv(results),
      exportFilename(specId, "csv"),
      "text/csv;charset=utf-8"
    );
  };

  const handleDownloadExcel = async () => {
    try {
      await downloadExcelWorkbook(exportFilename(specId, "xlsx"), [
        {
          name: "Smoke results",
          rows: resultsToRows(results),
          columns: SMOKE_COLUMNS,
        },
      ]);
      toast.success("Excel downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <Download className="size-4 mr-1.5" aria-hidden />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handleCopyJson()}>
          <Copy className="size-4 mr-2" aria-hidden />
          Copy JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadCsv}>
          <Download className="size-4 mr-2" aria-hidden />
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleDownloadExcel()}>
          <Download className="size-4 mr-2" aria-hidden />
          Download Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SmokeRow({
  result,
  endpoint,
  running,
  specId,
  open,
  onOpenChange,
  onRerun,
}: {
  result: SmokeResult;
  endpoint?: PlaygroundEndpoint;
  running: boolean;
  specId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRerun: () => void;
}) {
  const statusLabel = result.skipped
    ? `Skipped (${result.skipped})`
    : result.status > 0
      ? `${result.status}${result.statusText ? ` ${result.statusText}` : ""}`
      : "Error";

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          "relative z-0 rounded-md border bg-background text-sm",
          !result.ok && !result.skipped && "border-destructive/40"
        )}
      >
        <CollapsibleTrigger
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <MethodBadge method={result.method} className="shrink-0 text-xs" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs">
            {result.path}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1 tabular-nums text-xs font-normal",
              statusChipClass(result)
            )}
          >
            <StatusOutcomeIcon result={result} />
            {statusLabel}
          </Badge>
          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
            {result.latencyMs}ms
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-visible data-[state=closed]:overflow-hidden">
          <div className="space-y-3 border-t px-3 py-3 text-xs">
            {result.error ? (
              <div>
                <p className="mb-1 font-medium text-destructive">Error</p>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-destructive/10 p-2 text-destructive">
                  {result.error}
                </pre>
              </div>
            ) : null}

            {result.responseHeaders &&
            Object.keys(result.responseHeaders).length > 0 ? (
              <div>
                <p className="mb-1 font-medium text-muted-foreground">
                  Response headers
                </p>
                <ul className="max-h-28 overflow-auto rounded border bg-muted/30 p-2 font-mono">
                  {Object.entries(result.responseHeaders).map(([k, v]) => (
                    <li key={k} className="truncate">
                      <span className="text-muted-foreground">{k}:</span> {v}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.responseBodyPreview ? (
              <div>
                <p className="mb-1 font-medium text-muted-foreground">
                  Response body
                </p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-2 font-mono">
                  {result.responseBodyPreview}
                </pre>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={running || !endpoint}
                onClick={(e) => {
                  e.stopPropagation();
                  onRerun();
                }}
              >
                Rerun
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function SmokeLoadingSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border p-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export function SmokeTestDialog({
  open,
  onOpenChange,
  specId,
  endpoints,
  workingPaths = new Set(),
  baseUrl,
  credential,
  apiData,
}: SmokeTestDialogProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SmokeResult[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failedOnly, setFailedOnly] = useState(false);
  const [concurrency, setConcurrency] = useState(4);
  const [includeSkippedInFailed, setIncludeSkippedInFailed] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const targetEndpoints = useMemo(() => {
    if (workingPaths.size === 0) return endpoints;
    return endpoints.filter((ep) =>
      workingPaths.has(`${ep.method.toUpperCase()}:${ep.path}`)
    );
  }, [endpoints, workingPaths]);

  const runnerOpts = useMemo(
    () => ({
      endpoints: targetEndpoints,
      baseUrl,
      credential,
      apiData,
    }),
    [targetEndpoints, baseUrl, credential, apiData]
  );

  const endpointByKey = useMemo(() => {
    const m = new Map<string, PlaygroundEndpoint>();
    for (const ep of targetEndpoints) {
      m.set(`${ep.method.toUpperCase()}:${ep.path}`, ep);
    }
    return m;
  }, [targetEndpoints]);

  const aggregate = useMemo(() => smokeAggregate(results), [results]);

  const run = useCallback(async () => {
    if (targetEndpoints.length === 0) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setResults([]);
    setExpandedKeys(new Set());
    setProgress({ done: 0, total: targetEndpoints.length });

    try {
      const out = await runSmokeTests({
        ...runnerOpts,
        concurrency,
        signal: ac.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResults(out);
    } catch {
      /* aborted */
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [targetEndpoints, runnerOpts, concurrency]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const rerunOne = useCallback(
    async (ep: PlaygroundEndpoint) => {
      const key = `${ep.method.toUpperCase()}:${ep.path}`;
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      const one = await smokeOneEndpoint(ep, runnerOpts);
      setResults((prev) => {
        const idx = prev.findIndex(
          (r) =>
            r.method.toUpperCase() === ep.method.toUpperCase() &&
            r.path === ep.path
        );
        if (idx < 0) return [...prev, one];
        const next = [...prev];
        next[idx] = one;
        return next;
      });
    },
    [runnerOpts]
  );

  const filtered = useMemo(() => {
    if (!failedOnly) return results;
    return results.filter((r) => {
      if (r.ok) return false;
      if (!includeSkippedInFailed && r.skipped) return false;
      return true;
    });
  }, [results, failedOnly, includeSkippedInFailed]);

  const grouped = useMemo(() => {
    const map = new Map<string, SmokeResult[]>();
    for (const r of filtered) {
      const tag = r.controller || "Other";
      const list = map.get(tag) ?? [];
      list.push(r);
      map.set(tag, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const showEmpty = results.length === 0 && !running;
  const showLoadingSkeleton = running && results.length === 0;
  const allPassed =
    results.length > 0 &&
    !running &&
    aggregate.failed === 0 &&
    aggregate.passed > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full max-h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        aria-describedby="smoke-test-desc"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative z-20 shrink-0 border-b bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
          <SheetHeader className="px-6 py-4 text-left">
            <SheetTitle>Smoke tests</SheetTitle>
            <SheetDescription id="smoke-test-desc">
              Run sample requests against {targetEndpoints.length} working
              endpoint
              {targetEndpoints.length === 1 ? "" : "s"} (2xx–3xx = pass).
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void run()}
              disabled={running || targetEndpoints.length === 0}
            >
              {running ? "Running…" : "Run all"}
            </Button>
            {running ? (
              <Button type="button" size="sm" variant="outline" onClick={stop}>
                Stop
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={failedOnly ? "secondary" : "outline"}
              onClick={() => setFailedOnly((v) => !v)}
              disabled={results.length === 0}
              aria-pressed={failedOnly}
            >
              Failed only
            </Button>
            <SmokeConfigPopover
              concurrency={concurrency}
              onConcurrencyChange={setConcurrency}
              includeSkippedInFailed={includeSkippedInFailed}
              onIncludeSkippedInFailedChange={setIncludeSkippedInFailed}
              disabled={running}
            />
            {results.length > 0 ? (
              <Badge variant="secondary" className="ml-auto tabular-nums">
                {aggregate.passed}/{targetEndpoints.length}
              </Badge>
            ) : null}
          </div>

          <div
            className="mt-3"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {running || progress.total > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {running
                      ? `Running ${progress.done} / ${progress.total}`
                      : `Finished ${progress.done} / ${progress.total}`}
                  </span>
                  {results.length > 0 ? (
                    <span className="tabular-nums">
                      {aggregate.passed} passed · {aggregate.failed} failed ·{" "}
                      {aggregate.skipped} skipped
                    </span>
                  ) : null}
                </div>
                <Progress
                  value={
                    progress.total > 0
                      ? (progress.done / progress.total) * 100
                      : 0
                  }
                  className="h-2"
                  aria-label="Smoke test progress"
                />
              </div>
            ) : null}
          </div>
          </div>
        </div>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-6 py-4">
          {showLoadingSkeleton ? <SmokeLoadingSkeleton /> : null}

          {showEmpty ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <FlaskConical
                className="size-10 text-muted-foreground"
                aria-hidden
              />
              <p className="max-w-sm text-sm text-muted-foreground">
                Run smoke tests against working endpoints to verify they respond
                with sample payloads.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => void run()}
                disabled={targetEndpoints.length === 0}
              >
                Run smoke tests
              </Button>
            </div>
          ) : null}

          {allPassed ? (
            <div
              className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
              role="status"
            >
              <Check className="size-4 shrink-0" aria-hidden />
              All {aggregate.passed} tests passed.
            </div>
          ) : null}

          {!showEmpty && !showLoadingSkeleton ? (
            <div className="space-y-4">
              {grouped.map(([tag, rows], groupIndex) => (
                <section
                  key={tag}
                  className={cn(groupIndex > 0 && "mt-6 border-t pt-4")}
                >
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {tag}
                  </h3>
                  <ul className="space-y-2">
                    {rows.map((r) => {
                      const key = resultKey(r);
                      const ep = endpointByKey.get(key);
                      return (
                        <li key={key}>
                          <SmokeRow
                            result={r}
                            endpoint={ep}
                            running={running}
                            specId={specId}
                            open={expandedKeys.has(key)}
                            onOpenChange={(isOpen) => {
                              setExpandedKeys((prev) => {
                                const next = new Set(prev);
                                if (isOpen) next.add(key);
                                else next.delete(key);
                                return next;
                              });
                            }}
                            onRerun={() => {
                              if (ep) void rerunOne(ep);
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {failedOnly && grouped.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No failed results to show.
                </p>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>

        <div className="relative z-20 shrink-0 border-t bg-background px-6 py-3">
          <SmokeExportMenu
            results={results}
            specId={specId}
            disabled={results.length === 0}
          />
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
