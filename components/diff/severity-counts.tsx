"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import type { Severity, SeverityFilter } from "@/lib/openapi-diff";
import { cn } from "@/lib/utils";

const ALL_SEVERITIES: Severity[] = ["breaking", "non-breaking", "additive"];

const SEVERITY_STYLES: Record<Severity, string> = {
  breaking: "data-[state=on]:bg-destructive/15 data-[state=on]:text-destructive",
  "non-breaking": "data-[state=on]:bg-warning/15 data-[state=on]:text-warning",
  additive: "data-[state=on]:bg-success/15 data-[state=on]:text-success",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  breaking: "Breaking",
  "non-breaking": "Non-breaking",
  additive: "Additive",
};

type SeverityCountsProps = {
  counts: { breaking: number; nonBreaking: number; additive: number };
  selected: SeverityFilter[];
  onSelectedChange: (severities: SeverityFilter[]) => void;
  className?: string;
};

function countFor(severity: Severity, counts: SeverityCountsProps["counts"]): number {
  if (severity === "breaking") return counts.breaking;
  if (severity === "non-breaking") return counts.nonBreaking;
  return counts.additive;
}

export function SeverityCountsToggle({
  counts,
  selected,
  onSelectedChange,
  className,
}: SeverityCountsProps) {
  const active = ALL_SEVERITIES.filter((s) => countFor(s, counts) > 0);
  if (active.length === 0) return null;

  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="sm"
      value={selected.filter((s) => s !== "all")}
      onValueChange={(v) => onSelectedChange(v as SeverityFilter[])}
      className={cn("flex flex-wrap gap-1", className)}
    >
      {active.map((severity) => (
        <ToggleGroupItem
          key={severity}
          value={severity}
          className={cn("gap-1.5 px-2.5", SEVERITY_STYLES[severity])}
        >
          {SEVERITY_LABELS[severity]}
          <Badge variant="secondary" className="h-5 min-w-5 px-1 tabular-nums">
            {countFor(severity, counts)}
          </Badge>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
