"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, ExternalLink, RotateCcw } from "lucide-react";
import {
  listVersions,
  restoreVersion,
  type HistoryEntry,
} from "@/lib/data-service";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { SeverityBadge } from "@/components/diff/severity-badge";
import { diffIsEmpty } from "@/lib/openapi-diff";

function formatDate(ts: string) {
  const d = new Date(Number(ts));
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type VersionHistorySheetProps = {
  specId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored?: () => void;
};

export function VersionHistorySheet({
  specId,
  open,
  onOpenChange,
  onRestored,
}: VersionHistorySheetProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const load = async () => {
    setLoading(true);
    try {
      const data = await listVersions(specId);
      setEntries(data.entries);
    } catch {
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && specId) load();
  }, [open, specId]);

  const handleRestore = async (ts: string) => {
    const ok = await confirm({
      title: "Restore this version?",
      description:
        "The current spec will be replaced. A new history entry will be created.",
      confirmLabel: "Restore",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await restoreVersion(specId, ts);
      toast.success("Version restored");
      await load();
      onRestored?.();
    } catch {
      toast.error("Failed to restore version");
    }
  };

  return (
    <>
      {dialog}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Version history
            </SheetTitle>
            <SheetDescription>
              Snapshots for <span className="font-medium">{specId}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No version history yet. Upload a new version to start tracking.
              </p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.ts}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info" className="tabular-nums">
                          v{entry.version}
                        </Badge>
                        {entry.summary &&
                          !diffIsEmpty(entry.summary) && (
                            <SeverityBadge
                              severity={entry.summary.worstSeverity}
                            />
                          )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {formatDate(entry.ts)}
                      </p>
                      {entry.summaryLabel && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.summaryLabel}
                        </p>
                      )}
                      {entry.note && (
                        <p className="text-sm mt-2 text-foreground/80 line-clamp-2">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="xs" variant="outline" asChild>
                      <Link
                        href={`/documentation/${specId}/history?from=${entry.ts}&to=current`}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View diff
                      </Link>
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleRestore(entry.ts)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <Button className="w-full mt-6" variant="outline" asChild>
            <Link href={`/documentation/${specId}/history`}>
              Open full history page
            </Link>
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
