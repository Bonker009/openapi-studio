"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Search,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ValidationResultRow } from "@/components/playground/validation-result-row";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import type { ValidationAggregate } from "@/lib/validation/aggregate";
import type { ValidationResult } from "@/lib/validation/types";
import { endpointKey } from "@/lib/validation/types";
import { cn } from "@/lib/utils";

export type ResultFilter = "all" | "fail" | "error" | "pass";

const RESULTS_PAGE_SIZE = 100;
const CASES_PER_ENDPOINT_PREVIEW = 25;

const STAT_PILLS: {
  id: ResultFilter;
  label: string;
  icon?: LucideIcon;
}[] = [
  { id: "all", label: "All", icon: ListChecks },
  { id: "fail", label: "Failed", icon: XCircle },
  { id: "error", label: "Errors", icon: AlertTriangle },
  { id: "pass", label: "Passed", icon: CheckCircle2 },
];

function matchesFilter(r: ValidationResult, filter: ResultFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pass") return r.ok;
  if (filter === "fail") return r.outcome === "fail";
  if (filter === "error") return r.outcome === "error";
  return true;
}

function matchesSearch(r: ValidationResult, q: string): boolean {
  if (!q) return true;
  const hay = [
    r.path,
    r.method,
    r.name,
    r.fieldPath,
    r.variant,
    r.category,
    r.controller,
    String(r.status),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

type ValidationResultsPanelProps = {
  results: ValidationResult[];
  running: boolean;
  aggregate: ValidationAggregate;
  filter: ResultFilter;
  onFilterChange: (f: ResultFilter) => void;
  endpointByKey: Map<string, PlaygroundEndpoint>;
  specId: string;
  expandedKeys: Set<string>;
  onExpandedKeysChange: (keys: Set<string>) => void;
  onRerunCase: (result: ValidationResult, ep: PlaygroundEndpoint) => Promise<void>;
};

export function ValidationResultsPanel({
  results,
  running,
  aggregate,
  filter,
  onFilterChange,
  endpointByKey,
  specId,
  expandedKeys,
  onExpandedKeysChange,
  onRerunCase,
}: ValidationResultsPanelProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"flat" | "grouped">("flat");
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(
    new Set()
  );
  const prevRunning = useRef(running);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    const justFinished = prevRunning.current && !running;
    prevRunning.current = running;
    if (!justFinished || results.length === 0) return;
    const withIssues = new Set<string>();
    for (const r of results) {
      if (!r.ok && r.outcome !== "skipped") {
        withIssues.add(endpointKey(r));
      }
    }
    if (withIssues.size > 0) {
      setExpandedEndpoints(withIssues);
      if (aggregate.failed > 0) onFilterChange("fail");
    }
  }, [running, results, aggregate.failed, onFilterChange]);

  const filtered = useMemo(() => {
    return results.filter(
      (r) => matchesFilter(r, filter) && matchesSearch(r, deferredSearch)
    );
  }, [results, filter, deferredSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, ValidationResult[]>();
    for (const r of filtered) {
      const key = endpointKey(r);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([key, rows]) => {
        const passed = rows.filter((r) => r.ok).length;
        const failed = rows.filter((r) => r.outcome === "fail").length;
        const errors = rows.filter((r) => r.outcome === "error").length;
        return { key, rows, passed, failed, errors, total: rows.length };
      })
      .sort((a, b) => {
        const aBad = a.failed + a.errors;
        const bBad = b.failed + b.errors;
        if (aBad !== bBad) return bBad - aBad;
        return a.key.localeCompare(b.key);
      });
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / RESULTS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paginatedFlat = useMemo(() => {
    const start = safePage * RESULTS_PAGE_SIZE;
    return filtered.slice(start, start + RESULTS_PAGE_SIZE);
  }, [filtered, safePage]);

  const renderResultRow = (r: ValidationResult, ep?: PlaygroundEndpoint) => (
    <ValidationResultRow
      result={r}
      endpoint={ep}
      specId={specId}
      compact
      open={expandedKeys.has(r.caseId)}
      onOpenChange={(isOpen) => {
        const next = new Set(expandedKeys);
        if (isOpen) next.add(r.caseId);
        else next.delete(r.caseId);
        onExpandedKeysChange(next);
      }}
      running={running}
      onRerun={ep ? () => onRerunCase(r, ep) : undefined}
    />
  );

  return (
    <div className="flex flex-col min-h-0 gap-3">
      <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10 shrink-0 space-y-1.5 border-b bg-background pb-1.5 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Total {aggregate.total}
            </span>
            {STAT_PILLS.map((chip) => {
              const Icon = chip.icon;
              const active = filter === chip.id;
              const count =
                chip.id === "all"
                  ? aggregate.total
                  : chip.id === "pass"
                    ? aggregate.passed
                    : chip.id === "fail"
                      ? aggregate.failed
                      : aggregate.errors;
              return (
                <Button
                  key={chip.id}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-xs gap-1",
                    chip.id === "fail" &&
                      active &&
                      "border-destructive/40 text-destructive",
                    chip.id === "error" &&
                      active &&
                      "border-amber-500/40 text-amber-700 dark:text-amber-400",
                    chip.id === "pass" && active && "border-success/40 text-success"
                  )}
                  onClick={() =>
                    onFilterChange(
                      active ? "all" : chip.id
                    )
                  }
                >
                  {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
                  {chip.label}
                  <span className="tabular-nums">{count}</span>
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search
                className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search path, field, variant…"
                value={search}
                className="h-8 pl-8 text-xs"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {filtered.length}/{results.length}
            </span>
            <div className="flex rounded-md border p-0.5 bg-muted/30">
              <Button
                type="button"
                variant={viewMode === "flat" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setViewMode("flat")}
              >
                List
              </Button>
              <Button
                type="button"
                variant={viewMode === "grouped" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setViewMode("grouped")}
              >
                By endpoint
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1 pt-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              {filter === "pass" ? (
                <CheckCircle2 className="size-8 text-success opacity-80" />
              ) : (
                <Search className="size-8 opacity-40" />
              )}
              <p>No cases match the current filter.</p>
            </div>
          ) : viewMode === "flat" ? (
            <ul className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">
              {paginatedFlat.map((r) => {
                const ep = endpointByKey.get(endpointKey(r));
                return <li key={r.caseId}>{renderResultRow(r, ep)}</li>;
              })}
            </ul>
          ) : (
            <div className="space-y-3">
              {grouped.map((group) => {
                const ep = endpointByKey.get(group.key);
                const isOpen = expandedEndpoints.has(group.key);
                const hasIssues = group.failed + group.errors > 0;
                const preview = group.rows.slice(0, CASES_PER_ENDPOINT_PREVIEW);
                const rest = group.rows.length - preview.length;
                const visibleRows = isOpen ? group.rows : preview;

                return (
                  <Collapsible
                    key={group.key}
                    open={isOpen}
                    onOpenChange={(open) => {
                      setExpandedEndpoints((prev) => {
                        const next = new Set(prev);
                        if (open) next.add(group.key);
                        else next.delete(group.key);
                        return next;
                      });
                    }}
                  >
                    <div
                      className={cn(
                        "rounded-lg border",
                        hasIssues ? "border-destructive/30" : "border-border"
                      )}
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 rounded-t-lg">
                        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono text-xs font-medium truncate">
                            {group.key}
                          </span>
                          {group.failed > 0 ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-0.5 border-destructive/40 text-destructive"
                            >
                              <XCircle className="size-2.5" />
                              {group.failed} failed
                            </Badge>
                          ) : null}
                          {group.errors > 0 ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-0.5 text-amber-700 dark:text-amber-400"
                            >
                              <AlertTriangle className="size-2.5" />
                              {group.errors} errors
                            </Badge>
                          ) : null}
                          {group.passed > 0 && !hasIssues ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-0.5 text-success"
                            >
                              <CheckCircle2 className="size-2.5" />
                              {group.passed} passed
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {group.total} cases
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start px-2 pb-2 border-t pt-2">
                          {visibleRows.map((r) => (
                            <li key={r.caseId}>{renderResultRow(r, ep)}</li>
                          ))}
                          {!isOpen && rest > 0 ? (
                            <li className="col-span-full py-1 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  setExpandedEndpoints((prev) =>
                                    new Set(prev).add(group.key)
                                  )
                                }
                              >
                                Show {rest} more…
                              </Button>
                            </li>
                          ) : null}
                        </ul>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>

        {viewMode === "flat" && filtered.length > RESULTS_PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-2 pt-2 border-t shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-3.5 mr-1" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {safePage + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
