"use client";

import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/lib/openapi-diff";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<
  Severity,
  { label: string; className: string }
> = {
  breaking: {
    label: "Breaking",
    className:
      "bg-destructive/10 text-destructive border-destructive/30 font-semibold",
  },
  "non-breaking": {
    label: "Non-breaking",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  additive: {
    label: "Additive",
    className: "bg-success/10 text-success border-success/30",
  },
};

type SeverityBadgeProps = {
  severity: Severity;
  className?: string;
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const s = SEVERITY_STYLES[severity];
  return (
    <Badge variant="outline" className={cn("text-[10px]", s.className, className)}>
      {s.label}
    </Badge>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        s.className
      )}
    >
      {s.label}
    </span>
  );
}
