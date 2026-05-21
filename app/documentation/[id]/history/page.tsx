"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listVersions,
  getDiff,
  restoreVersion,
  deleteVersion,
  type HistoryEntry,
} from "@/lib/data-service";
import type { DiffSummary } from "@/lib/openapi-diff";
import { DiffView } from "@/components/diff/diff-view";
import { VersionPicker } from "@/components/diff/version-picker";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { RotateCcw, Trash2, ArrowLeftRight } from "lucide-react";

function formatDate(ts: string) {
  return new Date(Number(ts)).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
        toast.error("Failed to compute diff");
      } finally {
        setDiffLoading(false);
      }
    })();
  }, [id, fromTs, toTs]);

  const handleSwap = () => {
    if (fromTs === "current" && toTs === "current") return;
    const newFrom = toTs === "current" ? entries[0]?.ts ?? "" : toTs;
    const newTo = fromTs || "current";
    setFromTs(newFrom);
    setToTs(newTo);
  };

  const handleRestore = async () => {
    if (!fromTs || fromTs === "current") return;
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
      description: "This version will be removed from history.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteVersion(id, ts);
      toast.success("Version deleted");
      if (fromTs === ts) setFromTs("");
      if (toTs === ts) setToTs("current");
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const fromLabel = fromTs
    ? fromTs === "current"
      ? "Current"
      : formatDate(fromTs)
    : "—";
  const toLabel =
    toTs === "current" ? "Current" : toTs ? formatDate(toTs) : "—";

  return (
    <div className="min-h-screen bg-background">
      {dialog}
      <Header
        title="Version history"
        description={id}
        showBackButton
        specId={id}
      />

      <main className="container mx-auto py-8 px-4 max-w-screen-2xl">
        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant="outline" asChild>
            <Link href={`/documentation/${id}`}>Back to docs</Link>
          </Button>
          <Button
            variant="outline"
            disabled={!fromTs || fromTs === "current"}
            onClick={handleRestore}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore &quot;From&quot; version
          </Button>
        </div>

        <div className="grid lg:grid-cols-[minmax(280px,320px)_1fr] gap-6">
          <div className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Compare versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <VersionPicker
                  label="From (older)"
                  value={fromTs}
                  entries={entries}
                  onChange={setFromTs}
                  formatDate={formatDate}
                />
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSwap}
                    title="Swap from and to"
                    aria-label="Swap versions"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </div>
                <VersionPicker
                  label="To (newer)"
                  value={toTs}
                  entries={entries}
                  onChange={setToTs}
                  allowCurrent
                  formatDate={formatDate}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">All versions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[50vh] overflow-y-auto">
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <>
                    <div className="rounded-lg border p-3 text-sm bg-primary/5 border-primary/30">
                      <Badge variant="brand">Current</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Latest saved spec
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <Button
                          size="xs"
                          variant={toTs === "current" ? "default" : "outline"}
                          onClick={() => setToTs("current")}
                        >
                          Set as To
                        </Button>
                      </div>
                    </div>
                    {entries.map((entry) => (
                      <div
                        key={entry.ts}
                        className={`rounded-lg border p-3 text-sm ${
                          fromTs === entry.ts || toTs === entry.ts
                            ? "border-primary/40 bg-primary/5"
                            : ""
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <Badge variant="info" className="tabular-nums">
                              v{entry.version}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                              {formatDate(entry.ts)}
                            </p>
                            {entry.summaryLabel && (
                              <p className="text-xs mt-0.5">
                                {entry.summaryLabel}
                              </p>
                            )}
                            {entry.note && (
                              <p className="text-xs mt-1 text-foreground/80 line-clamp-2">
                                {entry.note}
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => handleDeleteVersion(entry.ts)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Button
                            size="xs"
                            variant={
                              fromTs === entry.ts ? "default" : "outline"
                            }
                            onClick={() => setFromTs(entry.ts)}
                          >
                            Set as From
                          </Button>
                          <Button
                            size="xs"
                            variant={toTs === entry.ts ? "default" : "outline"}
                            onClick={() => setToTs(entry.ts)}
                          >
                            Set as To
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                Changes: {fromLabel} → {toLabel}
              </h2>
              {summary && (
                <Badge variant="info" className="capitalize">
                  Suggested {summary.suggestedBump}
                </Badge>
              )}
            </div>
            <DiffView
              summary={summary}
              loading={diffLoading}
              showSuggestedBump={false}
            />
          </div>
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
