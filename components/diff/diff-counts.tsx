"use client";

import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DiffKind, DiffSummary } from "@/lib/openapi-diff";
import { DIFF_KIND_LABELS } from "@/components/diff/labels";
import { cn } from "@/lib/utils";

const ALL_KINDS: DiffKind[] = ["added", "removed", "changed", "moved"];

const KIND_STYLES: Record<DiffKind, string> = {
  added: "data-[state=on]:bg-success/15 data-[state=on]:text-success",
  removed: "data-[state=on]:bg-destructive/15 data-[state=on]:text-destructive",
  changed: "data-[state=on]:bg-warning/15 data-[state=on]:text-warning",
  moved: "data-[state=on]:bg-info/15 data-[state=on]:text-info",
};

function countForKind(summary: DiffSummary, kind: DiffKind): number {
  switch (kind) {
    case "added":
      return summary.added.length;
    case "removed":
      return summary.removed.length;
    case "changed":
      return summary.changed.length;
    case "moved":
      return summary.moved?.length ?? 0;
  }
}

type DiffCountsProps = {
  summary: DiffSummary;
  selected: DiffKind[];
  onSelectedChange: (kinds: DiffKind[]) => void;
  className?: string;
};

export function DiffCounts({
  summary,
  selected,
  onSelectedChange,
  className,
}: DiffCountsProps) {
  const activeKinds = ALL_KINDS.filter((k) => countForKind(summary, k) > 0);

  if (activeKinds.length === 0) return null;

  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="sm"
      value={selected}
      onValueChange={(v) => onSelectedChange(v as DiffKind[])}
      className={cn("flex flex-wrap gap-1", className)}
    >
      {activeKinds.map((kind) => {
        const count = countForKind(summary, kind);
        return (
          <ToggleGroupItem
            key={kind}
            value={kind}
            className={cn("gap-1.5 px-2.5", KIND_STYLES[kind])}
            aria-label={`${DIFF_KIND_LABELS[kind]} (${count})`}
          >
            {DIFF_KIND_LABELS[kind]}
            <Badge variant="secondary" className="h-5 min-w-5 px-1 tabular-nums">
              {count}
            </Badge>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
