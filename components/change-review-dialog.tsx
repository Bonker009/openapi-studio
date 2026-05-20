"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { DiffSummary } from "@/lib/openapi-diff";
import { formatDiffCounts } from "@/lib/openapi-diff";
import { MethodBadge } from "@/components/method-badge";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review API changes</DialogTitle>
          <DialogDescription>
            {formatDiffCounts(summary)} — suggested{" "}
            <Badge variant="info">{summary.suggestedBump}</Badge> bump
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {summary.added.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center gap-2 font-medium text-teal-700">
                <ChevronDown className="h-4 w-4" />
                Added ({summary.added.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 pl-6">
                {summary.added.map((e) => (
                  <div key={`${e.method}-${e.path}`} className="flex gap-2">
                    <MethodBadge method={e.method} />
                    <span className="font-mono text-xs">{e.path}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          {summary.removed.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center gap-2 font-medium text-destructive">
                <ChevronDown className="h-4 w-4" />
                Removed ({summary.removed.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 pl-6">
                {summary.removed.map((e) => (
                  <div key={`${e.method}-${e.path}`} className="flex gap-2">
                    <MethodBadge method={e.method} />
                    <span className="font-mono text-xs">{e.path}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          {summary.changed.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center gap-2 font-medium text-amber-700">
                <ChevronDown className="h-4 w-4" />
                Changed ({summary.changed.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 pl-6">
                {summary.changed.map((e) => (
                  <div key={`${e.method}-${e.path}`} className="flex flex-col gap-0.5">
                    <div className="flex gap-2">
                      <MethodBadge method={e.method} />
                      <span className="font-mono text-xs">{e.path}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {e.reasons.join(", ")}
                    </span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="review-version">Version</Label>
            <Input
              id="review-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="review-note">Changelog note</Label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed in this release?"
              className="mt-1 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(version, note)}
            disabled={isSaving || !version.trim()}
          >
            {isSaving ? "Saving…" : "Save as new version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
