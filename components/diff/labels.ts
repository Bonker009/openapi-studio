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
    dot: "bg-teal-500",
    pill: "bg-teal-50 text-teal-800 border-teal-200",
    pathNew: "bg-teal-50 border-teal-200/60",
  },
  removed: {
    label: "Removed",
    dot: "bg-red-500",
    pill: "bg-red-50 text-red-800 border-red-200",
    pathOld: "bg-red-50 border-red-200/60",
  },
  changed: {
    label: "Changed",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-800 border-amber-200",
  },
  moved: {
    label: "Moved",
    dot: "bg-sky-500",
    pill: "bg-sky-50 text-sky-800 border-sky-200",
    pathOld: "bg-muted border-border",
    pathNew: "bg-sky-50 border-sky-200/60",
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
