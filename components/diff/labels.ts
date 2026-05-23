import type { ChangeReason, DiffKind } from "@/lib/openapi-diff";

export const CHANGE_REASON_LABELS: Record<ChangeReason, string> = {
  params: "Parameters",
  requestBody: "Request body",
  responses: "Responses",
  operationId: "Operation ID",
  tags: "Tags",
  summary: "Summary",
};

export const DIFF_KIND_LABELS: Record<DiffKind, string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
  moved: "Moved",
};

export const DIFF_KIND_STYLES: Record<
  DiffKind,
  {
    label: string;
    dot: string;
    pill: string;
    pathNew?: string;
    pathOld?: string;
  }
> = {
  added: {
    label: "Added",
    dot: "bg-success",
    pill: "bg-success/10 text-success border-success/30",
    pathNew: "bg-success/10 border-success/30",
  },
  removed: {
    label: "Removed",
    dot: "bg-destructive",
    pill: "bg-destructive/10 text-destructive border-destructive/30",
    pathOld: "bg-destructive/10 border-destructive/30",
  },
  changed: {
    label: "Changed",
    dot: "bg-warning",
    pill: "bg-warning/10 text-warning border-warning/30",
  },
  moved: {
    label: "Moved",
    dot: "bg-info",
    pill: "bg-info/10 text-info border-info/30",
    pathOld: "bg-muted border-border",
    pathNew: "bg-info/10 border-info/30",
  },
};

export const DETAIL_SECTION_LABELS = {
  params: "Parameters",
  requestBody: "Request body",
  responses: "Response codes",
  operationId: "Operation ID",
  tags: "Tags",
  summary: "Summary",
} as const;

export function paramStatusLabel(
  status: "added" | "removed" | "changed"
): string {
  if (status === "added") return "Added";
  if (status === "removed") return "Removed";
  return "Changed";
}
