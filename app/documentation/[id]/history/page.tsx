"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MethodBadge } from "@/components/method-badge";
import {
  listVersions,
  getDiff,
  restoreVersion,
  deleteVersion,
  type HistoryEntry,
} from "@/lib/data-service";
import type { DiffSummary } from "@/lib/openapi-diff";
import { formatDiffCounts, diffIsEmpty } from "@/lib/openapi-diff";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { RotateCcw, Trash2 } from "lucide-react";

function formatDate(ts: string) {
  return new Date(Number(ts)).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DiffPanel({ summary }: { summary: DiffSummary | null }) {
  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Select two versions to compare
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium">{formatDiffCounts(summary)}</p>
      {summary.added.map((e) => (
        <div key={`a-${e.method}-${e.path}`} className="flex gap-2 text-teal-700">
          <span className="font-medium">+</span>
          <MethodBadge method={e.method} />
          <span className="font-mono text-xs">{e.path}</span>
        </div>
      ))}
      {summary.removed.map((e) => (
        <div
          key={`r-${e.method}-${e.path}`}
          className="flex gap-2 text-destructive"
        >
          <span className="font-medium">−</span>
          <MethodBadge method={e.method} />
          <span className="font-mono text-xs">{e.path}</span>
        </div>
      ))}
      {summary.changed.map((e) => (
        <div
          key={`c-${e.method}-${e.path}`}
          className="flex flex-col gap-0.5 text-amber-800"
        >
          <div className="flex gap-2">
            <span className="font-medium">~</span>
            <MethodBadge method={e.method} />
            <span className="font-mono text-xs">{e.path}</span>
          </div>
          <span className="text-xs text-muted-foreground pl-5">
            {e.reasons.join(", ")}
          </span>
        </div>
      ))}
      {diffIsEmpty(summary) && (
        <p className="text-muted-foreground">No structural differences</p>
      )}
    </div>
  );
}

function HistoryPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromTs, setFromTs] = useState(searchParams.get("from") || "");
  const [toTs, setToTs] = useState(searchParams.get("to") || "current");
  const [summary, setSummary] = useState<DiffSummary | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const load = async () => {
    setLoading(true);
    try {
      const data = await listVersions(id);
      setEntries(data.entries);
      if (!fromTs && data.entries[1]) {
        setFromTs(data.entries[1].ts);
      }
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  useEffect(() => {
    const qpFrom = searchParams.get("from");
    const qpTo = searchParams.get("to");
    if (qpFrom) setFromTs(qpFrom);
    if (qpTo) setToTs(qpTo);
  }, [searchParams]);

  useEffect(() => {
    if (!id || !fromTs) {
      setSummary(null);
      return;
    }
    (async () => {
      setDiffLoading(true);
      try {
        const { summary: s } = await getDiff(id, fromTs, toTs || "current");
        setSummary(s);
      } catch {
        setSummary(null);
      } finally {
        setDiffLoading(false);
      }
    })();
  }, [id, fromTs, toTs]);

  const handleRestore = async () => {
    if (!fromTs) return;
    const ok = await confirm({
      title: "Restore this version?",
      description: "Current spec will be replaced and a new history entry created.",
      confirmLabel: "Restore",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await restoreVersion(id, fromTs);
      toast.success("Restored");
      await load();
      setToTs("current");
    } catch {
      toast.error("Restore failed");
    }
  };

  const handleDeleteVersion = async (ts: string) => {
    const ok = await confirm({
      title: "Delete snapshot?",
      description: "This version file will be removed from history.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteVersion(id, ts);
      toast.success("Version deleted");
      if (fromTs === ts) setFromTs("");
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {dialog}
      <Header
        title="Version history"
        description={id}
        showBackButton
        specId={id}
      />

      <main className="container mx-auto py-8 px-4">
        <div className="flex gap-2 mb-6">
          <Button variant="outline" asChild>
            <Link href={`/documentation/${id}`}>Back to docs</Link>
          </Button>
          <Button
            variant="outline"
            disabled={!fromTs}
            onClick={handleRestore}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore selected (from)
          </Button>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <Card className="shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-base">Versions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setToTs("current");
                    }}
                    className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                      toTs === "current"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Badge variant="brand">Current</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Latest saved spec
                    </p>
                  </button>
                  {entries.map((entry) => (
                    <div
                      key={entry.ts}
                      className={`rounded-lg border p-3 text-sm ${
                        fromTs === entry.ts
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <button
                          type="button"
                          className="text-left flex-1"
                          onClick={() => setFromTs(entry.ts)}
                        >
                          <Badge variant="info" className="tabular-nums">
                            v{entry.version}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                            {formatDate(entry.ts)}
                          </p>
                          {entry.summaryLabel && (
                            <p className="text-xs mt-0.5">{entry.summaryLabel}</p>
                          )}
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive shrink-0"
                          onClick={() => handleDeleteVersion(entry.ts)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="mt-2 h-6 text-xs"
                        onClick={() => setToTs(entry.ts)}
                      >
                        Compare to this
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                Diff: {fromTs ? formatDate(fromTs) : "—"} →{" "}
                {toTs === "current" ? "Current" : formatDate(toTs)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="summary">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="mt-4">
                  {diffLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <DiffPanel summary={summary} />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <HistoryPageContent />
    </Suspense>
  );
}
