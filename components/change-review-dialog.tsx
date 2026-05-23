"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DiffSummary } from "@/lib/openapi-diff";
import { formatDiffCounts, formatSeverityCounts } from "@/lib/openapi-diff";
import { SeverityBadge } from "@/components/diff/severity-badge";
import { DiffView } from "@/components/diff/diff-view";

type ChangeReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: DiffSummary;
  suggestedVersion: string;
  onConfirm: (version: string, note: string) => void;
  isSaving?: boolean;
};

export function ChangeReviewDialog({
  open,
  onOpenChange,
  summary,
  suggestedVersion,
  onConfirm,
  isSaving,
}: ChangeReviewDialogProps) {
  const [version, setVersion] = useState(suggestedVersion);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setVersion(suggestedVersion);
      setNote("");
    }
  }, [open, suggestedVersion]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[min(92dvh,920px)] max-h-[92dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-t-xl border-t p-0"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
          <SheetTitle>Review API changes</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span>{formatDiffCounts(summary)}</span>
              {formatSeverityCounts(summary) && (
                <>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-xs">{formatSeverityCounts(summary)}</span>
                </>
              )}
              {summary.worstSeverity === "breaking" && (
                <SeverityBadge severity="breaking" />
              )}
              <span className="text-muted-foreground">—</span>
              <span className="text-muted-foreground">suggested</span>
              <Badge variant="info" className="capitalize">
                {summary.suggestedBump}
              </Badge>
              <span className="text-muted-foreground">bump</span>
              {summary.infoChanged && (
                <Badge variant="outline">API info changed</Badge>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <DiffView summary={summary} embedded columns={2} />
        </div>

        <SheetFooter className="shrink-0 border-t bg-muted/30 px-6 py-4">
          <div className="flex w-full flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="review-version">Version</Label>
                <Input
                  id="review-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="mt-1 bg-background"
                />
              </div>
              <div>
                <Label htmlFor="review-note">Changelog note</Label>
                <Textarea
                  id="review-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What changed in this release?"
                  className="mt-1 min-h-[72px] bg-background"
                />
              </div>
            </div>
            <Separator />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => onConfirm(version, note)}
                disabled={isSaving || !version.trim()}
              >
                {isSaving ? "Saving…" : "Save as new version"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
