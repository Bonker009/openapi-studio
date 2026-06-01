"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus, History, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/src/shared/utils/format-time";
import type { DisplaySpec } from "../types";

function SpecMeta({ spec }: { spec: DisplaySpec }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1.5">
      <Badge variant="info" className="tabular-nums">
        v{spec.version}
      </Badge>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(spec.lastModified)}
      </span>
    </div>
  );
}

export function SpecActions({
  spec,
  onDelete,
  compact = false,
}: {
  spec: DisplaySpec;
  onDelete: (id: string, title: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex gap-2 shrink-0 ${compact ? "flex-col w-full" : "flex-wrap"}`}
    >
      <Button size="sm" className={compact ? "w-full" : undefined} asChild>
        <Link href={`/documentation/${spec.id}`}>View Docs</Link>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={compact ? "w-full" : undefined}
        asChild
      >
        <Link href={`/documentation/${spec.id}/history`}>
          <History className="h-4 w-4 mr-1" />
          History
        </Link>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`text-destructive hover:text-destructive ${compact ? "w-full" : ""}`}
        onClick={() => onDelete(spec.id, spec.displayTitle)}
      >
        <Trash2 className="h-4 w-4" />
        {compact && <span className="ml-1">Delete</span>}
      </Button>
    </div>
  );
}

export function ListSpecRow({
  spec,
  onDelete,
}: {
  spec: DisplaySpec;
  onDelete: (id: string, title: string) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card hover:bg-muted/30 transition-colors">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-medium truncate">{spec.displayTitle}</div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {spec.id}
            </p>
            <SpecMeta spec={spec} />
          </div>
        </div>
        <SpecActions spec={spec} onDelete={onDelete} />
      </div>
    </div>
  );
}

export function GridSpecCard({
  spec,
  onDelete,
}: {
  spec: DisplaySpec;
  onDelete: (id: string, title: string) => void;
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col gap-0">
      <CardHeader className="pb-0">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0 align-middle">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate leading-snug">
              {spec.displayTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {spec.id}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pt-0">
        {spec.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
            {spec.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            No description
          </p>
        )}
        <SpecMeta spec={spec} />
        <div className="mt-4 pt-4 border-t border-border">
          <SpecActions spec={spec} onDelete={onDelete} compact />
        </div>
      </CardContent>
    </Card>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function SpecEmptyState() {
  return (
    <div className="text-center py-12 border-2 border-dashed rounded-xl border-border">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h2 className="text-2xl font-semibold mb-2">No API specifications yet</h2>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Upload an OpenAPI spec to explore endpoints and track versions over time.
      </p>
      <Button size="lg" asChild>
        <Link href="/upload">
          <Plus className="h-4 w-4 mr-2" />
          Add specification
        </Link>
      </Button>
    </div>
  );
}

export function SpecListSection({
  viewMode,
  loading,
  specs,
  onDelete,
}: {
  viewMode: "list" | "grid";
  loading: boolean;
  specs: DisplaySpec[];
  onDelete: (id: string, title: string) => void;
}) {
  if (loading) {
    return viewMode === "list" ? <ListSkeleton /> : <GridSkeleton />;
  }
  if (specs.length === 0) {
    return <SpecEmptyState />;
  }
  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {specs.map((spec) => (
          <ListSpecRow key={spec.id} spec={spec} onDelete={onDelete} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {specs.map((spec) => (
        <GridSpecCard key={spec.id} spec={spec} onDelete={onDelete} />
      ))}
    </div>
  );
}
