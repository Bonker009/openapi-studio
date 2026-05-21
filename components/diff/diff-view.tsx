"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DiffKind, DiffSummary } from "@/lib/openapi-diff";
import { diffIsEmpty, formatDiffCounts } from "@/lib/openapi-diff";
import { DiffCounts } from "@/components/diff/diff-counts";
import {
  DiffEndpointCard,
  type DiffRow,
} from "@/components/diff/diff-endpoint-card";

const ALL_KINDS: DiffKind[] = ["added", "removed", "changed", "moved"];
const UNCATEGORIZED = "Other";

function buildRows(summary: DiffSummary): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const e of summary.added) rows.push({ kind: "added", data: e });
  for (const e of summary.removed) rows.push({ kind: "removed", data: e });
  for (const e of summary.changed) rows.push({ kind: "changed", data: e });
  for (const e of summary.moved ?? []) rows.push({ kind: "moved", data: e });
  return rows;
}

function rowTag(row: DiffRow): string {
  if (row.kind === "moved") return row.data.tag ?? UNCATEGORIZED;
  return row.data.tag ?? UNCATEGORIZED;
}

function rowSearchText(row: DiffRow): string {
  if (row.kind === "moved") {
    return `${row.data.method} ${row.data.from} ${row.data.to}`.toLowerCase();
  }
  return `${row.data.method} ${row.data.path}`.toLowerCase();
}

type DiffViewProps = {
  summary: DiffSummary | null;
  loading?: boolean;
  showSuggestedBump?: boolean;
  /** Omit outer Card wrapper (e.g. inside Dialog). */
  embedded?: boolean;
  /** 2 = two-column grid for endpoint cards (e.g. wide dialog). */
  columns?: 1 | 2;
  className?: string;
};

function DiffViewShell({
  embedded,
  className,
  children,
}: {
  embedded?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (embedded) {
    return <div className={className}>{children}</div>;
  }
  return <Card className={className}>{children}</Card>;
}

const rowListClass = (columns: 1 | 2) =>
  columns === 2
    ? "grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2"
    : "space-y-2 pb-2";

export function DiffView({
  summary,
  loading = false,
  showSuggestedBump = false,
  embedded = false,
  columns = 1,
  className,
}: DiffViewProps) {
  const [search, setSearch] = useState("");
  const [selectedKinds, setSelectedKinds] = useState<DiffKind[]>(ALL_KINDS);

  const filteredGroups = useMemo(() => {
    if (!summary) return [];
    const q = search.trim().toLowerCase();
    const rows = buildRows(summary).filter((row) => {
      if (!selectedKinds.includes(row.kind)) return false;
      if (q && !rowSearchText(row).includes(q)) return false;
      return true;
    });

    const groups = new Map<string, DiffRow[]>();
    for (const row of rows) {
      const tag = rowTag(row);
      const list = groups.get(tag) ?? [];
      list.push(row);
      groups.set(tag, list);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [summary, search, selectedKinds]);

  if (loading) {
    return (
      <DiffViewShell embedded={embedded} className={className}>
        {!embedded && (
          <CardHeader className="pb-3">
            <Skeleton className="h-8 w-64" />
          </CardHeader>
        )}
        <CardContent className={embedded ? "space-y-3 p-0" : "space-y-3"}>
          {embedded && <Skeleton className="h-8 w-64" />}
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </DiffViewShell>
    );
  }

  if (!summary) {
    return (
      <DiffViewShell embedded={embedded} className={className}>
        <CardContent
          className={
            embedded
              ? "py-8 text-center text-sm text-muted-foreground p-0"
              : "py-12 text-center text-sm text-muted-foreground"
          }
        >
          Select two versions to compare
        </CardContent>
      </DiffViewShell>
    );
  }

  if (diffIsEmpty(summary)) {
    return (
      <DiffViewShell embedded={embedded} className={className}>
        <CardContent
          className={
            embedded
              ? "py-8 text-center text-sm text-muted-foreground p-0"
              : "py-12 text-center text-sm text-muted-foreground"
          }
        >
          No structural differences between these versions
        </CardContent>
      </DiffViewShell>
    );
  }

  return (
    <DiffViewShell embedded={embedded} className={className}>
      <CardHeader className={embedded ? "pb-3 space-y-3 px-0" : "pb-3 space-y-3"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{formatDiffCounts(summary)}</span>
          {showSuggestedBump && (
            <Badge variant="info" className="capitalize">
              Suggested {summary.suggestedBump} bump
            </Badge>
          )}
          {summary.infoChanged && (
            <Badge variant="outline">API info changed</Badge>
          )}
        </div>
        <DiffCounts
          summary={summary}
          selected={selectedKinds}
          onSelectedChange={setSelectedKinds}
        />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search path or method…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent className={embedded ? "px-0 min-h-0" : undefined}>
        {filteredGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No endpoints match your filters
          </p>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={filteredGroups.map(([tag]) => tag)}
            className="w-full"
          >
            {filteredGroups.map(([tag, rows]) => (
              <AccordionItem key={tag} value={tag}>
                <AccordionTrigger className="text-sm hover:no-underline py-3">
                  <span className="font-medium">{tag}</span>
                  <Badge variant="secondary" className="ml-2 tabular-nums">
                    {rows.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className={rowListClass(columns)}>
                    {rows.map((row) => (
                      <DiffEndpointCard
                        key={
                          row.kind === "moved"
                            ? `m-${row.data.method}-${row.data.from}-${row.data.to}`
                            : `${row.kind}-${row.data.method}-${row.data.path}`
                        }
                        row={row}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </DiffViewShell>
  );
}
