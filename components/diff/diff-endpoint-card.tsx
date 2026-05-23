"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { MethodBadge } from "@/components/method-badge";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type {
  DiffKind,
  EndpointChange,
  EndpointRef,
  MovedEndpoint,
} from "@/lib/openapi-diff";
import {
  CHANGE_REASON_LABELS,
  DETAIL_SECTION_LABELS,
  DIFF_KIND_STYLES,
  paramStatusLabel,
} from "@/components/diff/labels";
import { cn } from "@/lib/utils";
import { SeverityPill } from "@/components/diff/severity-badge";

export type DiffRow =
  | { kind: "added"; data: EndpointRef }
  | { kind: "removed"; data: EndpointRef }
  | { kind: "changed"; data: EndpointChange }
  | { kind: "moved"; data: MovedEndpoint };

/* ─── Shared atoms ───────────────────────────────────────────── */

function StatusBadge({ status }: { status: "added" | "removed" | "changed" }) {
  const cls =
    status === "added"
      ? "bg-success/10 text-success border-success/30"
      : status === "removed"
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : "bg-warning/10 text-warning border-warning/30";
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cls)}>
      {paramStatusLabel(status)}
    </Badge>
  );
}

/** Coloured dot + text pill, e.g. ● Added */
function KindPill({ kind }: { kind: DiffKind }) {
  const s = DIFF_KIND_STYLES[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        s.pill
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

/** Mono path displayed inside a subtle box. */
function PathBox({
  path,
  label,
  strikethrough,
  className,
}: {
  path: string;
  label?: string;
  strikethrough?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 py-1.5",
        className
      )}
    >
      {label && (
        <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      )}
      <p
        className={cn(
          "break-all font-mono text-[11px] leading-relaxed",
          strikethrough && "text-muted-foreground line-through"
        )}
      >
        {path}
      </p>
    </div>
  );
}

/* ─── Change details (expanded section) ─────────────────────── */

function ChangeDetails({ change }: { change: EndpointChange }) {
  const { details } = change;
  const hasDetails =
    details.params ||
    details.requestBody ||
    details.responses ||
    details.operationId ||
    details.tags ||
    details.summary;

  if (!hasDetails) {
    return (
      <p className="text-xs text-muted-foreground">
        {change.reasons.map((r) => CHANGE_REASON_LABELS[r]).join(" · ")}
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Params */}
      {details.params &&
        (details.params.added.length > 0 ||
          details.params.removed.length > 0 ||
          details.params.changed.length > 0) && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {DETAIL_SECTION_LABELS.params}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8">Name</TableHead>
                  <TableHead className="h-8">In</TableHead>
                  <TableHead className="h-8 w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.params.added.map((p) => (
                  <TableRow key={`a-${p.in}-${p.name}`}>
                    <TableCell className="py-1.5 font-mono text-xs">{p.name}</TableCell>
                    <TableCell className="py-1.5 text-xs">{p.in}</TableCell>
                    <TableCell className="py-1.5">
                      <StatusBadge status="added" />
                    </TableCell>
                  </TableRow>
                ))}
                {details.params.removed.map((p) => (
                  <TableRow key={`r-${p.in}-${p.name}`}>
                    <TableCell className="py-1.5 font-mono text-xs">{p.name}</TableCell>
                    <TableCell className="py-1.5 text-xs">{p.in}</TableCell>
                    <TableCell className="py-1.5">
                      <StatusBadge status="removed" />
                    </TableCell>
                  </TableRow>
                ))}
                {details.params.changed.map((p) => (
                  <TableRow key={`c-${p.in}-${p.name}`}>
                    <TableCell className="py-1.5 font-mono text-xs">{p.name}</TableCell>
                    <TableCell className="py-1.5 text-xs">{p.in}</TableCell>
                    <TableCell className="py-1.5">
                      <StatusBadge status="changed" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

      {/* Responses */}
      {details.responses &&
        (details.responses.added.length > 0 ||
          details.responses.removed.length > 0 ||
          details.responses.changed.length > 0) && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {DETAIL_SECTION_LABELS.responses}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {details.responses.added.map((c) => (
                <Badge key={`a-${c}`} variant="outline" className="tabular-nums bg-success/10 text-success border-success/30">
                  +{c}
                </Badge>
              ))}
              {details.responses.removed.map((c) => (
                <Badge key={`r-${c}`} variant="outline" className="tabular-nums bg-destructive/10 text-destructive border-destructive/30">
                  −{c}
                </Badge>
              ))}
              {details.responses.changed.map((c) => (
                <Badge key={`c-${c}`} variant="outline" className="tabular-nums bg-warning/10 text-warning border-warning/30">
                  ~{c}
                </Badge>
              ))}
            </div>
          </div>
        )}

      {/* Request body */}
      {details.requestBody &&
        (details.requestBody.added.length > 0 ||
          details.requestBody.removed.length > 0 ||
          details.requestBody.changed.length > 0) && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {DETAIL_SECTION_LABELS.requestBody}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {details.requestBody.added.map((m) => (
                <Badge key={`a-${m}`} variant="outline" className="font-mono text-xs bg-success/10 text-success border-success/30">
                  +{m}
                </Badge>
              ))}
              {details.requestBody.removed.map((m) => (
                <Badge key={`r-${m}`} variant="outline" className="font-mono text-xs bg-destructive/10 text-destructive border-destructive/30">
                  −{m}
                </Badge>
              ))}
              {details.requestBody.changed.map((m) => (
                <Badge key={`c-${m}`} variant="outline" className="font-mono text-xs bg-warning/10 text-warning border-warning/30">
                  ~{m}
                </Badge>
              ))}
            </div>
          </div>
        )}

      {/* Operation ID */}
      {details.operationId && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {DETAIL_SECTION_LABELS.operationId}
          </p>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-muted-foreground line-through">
              {details.operationId.from ?? "—"}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span>{details.operationId.to ?? "—"}</span>
          </div>
        </div>
      )}

      {/* Summary */}
      {details.summary && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {DETAIL_SECTION_LABELS.summary}
          </p>
          <div className="space-y-0.5 text-xs">
            {details.summary.from && (
              <p className="text-muted-foreground line-through">{details.summary.from}</p>
            )}
            {details.summary.to && <p>{details.summary.to}</p>}
          </div>
        </div>
      )}

      {/* Tags */}
      {details.tags &&
        (details.tags.added.length > 0 || details.tags.removed.length > 0) && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {DETAIL_SECTION_LABELS.tags}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {details.tags.removed.map((t) => (
                <Badge key={`r-${t}`} variant="outline" className="bg-destructive/10 text-destructive line-through">
                  {t}
                </Badge>
              ))}
              {details.tags.added.map((t) => (
                <Badge key={`a-${t}`} variant="outline" className="bg-success/10 text-success">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

/* ─── Base card shell ────────────────────────────────────────── */

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ─── Added / Removed ────────────────────────────────────────── */

function SimpleCard({
  row,
}: {
  row: DiffRow & { kind: "added" | "removed" };
}) {
  const s = DIFF_KIND_STYLES[row.kind];
  const isRemoved = row.kind === "removed";

  return (
    <Card>
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <KindPill kind={row.kind} />
        <SeverityPill severity={row.data.severity} />
        <MethodBadge method={row.data.method} className="shrink-0" />
      </div>
      <div className="px-3 pb-3">
        <PathBox
          path={row.data.path}
          strikethrough={isRemoved}
          className={isRemoved ? s.pathOld : s.pathNew}
        />
      </div>
    </Card>
  );
}

/* ─── Moved ──────────────────────────────────────────────────── */

function MovedCard({ row }: { row: DiffRow & { kind: "moved" } }) {
  const s = DIFF_KIND_STYLES.moved;

  return (
    <Card>
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <KindPill kind="moved" />
        <SeverityPill severity={row.data.severity} />
        <MethodBadge method={row.data.method} className="shrink-0" />
      </div>
      <div className="flex flex-col gap-1.5 px-3 pb-3 sm:flex-row sm:items-center">
        <PathBox
          path={row.data.from}
          label="Before"
          strikethrough
          className={s.pathOld}
        />
        <div className="flex shrink-0 justify-center sm:justify-start">
          <ArrowRight className="h-4 w-4 rotate-90 text-info sm:rotate-0" />
        </div>
        <PathBox
          path={row.data.to}
          label="After"
          className={s.pathNew}
        />
      </div>
    </Card>
  );
}

/* ─── Changed (expandable) ───────────────────────────────────── */

function ChangedCard({ row }: { row: DiffRow & { kind: "changed" } }) {
  const [open, setOpen] = useState(false);
  const change = row.data;
  const s = DIFF_KIND_STYLES.changed;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
            <KindPill kind="changed" />
            <SeverityPill severity={change.severity} />
            <MethodBadge method={change.method} className="shrink-0" />
            <div className="flex-1" />
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
          <div className="px-3 pb-2.5">
            <PathBox path={change.path} />
          </div>
          {change.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 pb-3">
              {change.reasons.map((r) => (
                <span
                  key={r}
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    s.pill
                  )}
                >
                  {CHANGE_REASON_LABELS[r]}
                </span>
              ))}
            </div>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="px-3 py-3">
            <ChangeDetails change={change} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/* ─── Public export ──────────────────────────────────────────── */

type DiffEndpointCardProps = {
  row: DiffRow;
  defaultOpen?: boolean;
};

export function DiffEndpointCard({ row }: DiffEndpointCardProps) {
  if (row.kind === "added" || row.kind === "removed") {
    return <SimpleCard row={row} />;
  }
  if (row.kind === "moved") {
    return <MovedCard row={row} />;
  }
  return <ChangedCard row={row} />;
}
