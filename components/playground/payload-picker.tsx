"use client";

import { useState, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { LiveJsonTree } from "@/components/playground/live-json-tree";
import { keyPathToAccessor, type PayloadSource } from "@/lib/flows/payload-tree";
import { cn } from "@/lib/utils";

type PayloadTreeViewProps = {
  body: unknown;
  source: PayloadSource;
  onPick: (path: string, preview: string) => void;
  /** Header shown above the tree; pass null to hide it. */
  title?: string | null;
  /** compact = popovers; panel = pause dialog */
  variant?: "compact" | "panel";
};

/** Source badge + clickable JSON field tree. Reused inline and inside the popover. */
export function PayloadTreeView({
  body,
  source,
  onPick,
  title = "Pick a field",
  variant = "compact",
}: PayloadTreeViewProps) {
  const sourceMeta =
    source === "live"
      ? { label: "Live data", className: "border-success/40 text-success" }
      : source === "sample"
        ? {
            label: "Example schema",
            className:
              "border-amber-500/40 text-amber-600 dark:text-amber-400",
          }
        : { label: "No payload", className: "text-muted-foreground" };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      {title !== null && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <span className="text-xs font-semibold">{title}</span>
          <Badge
            variant="outline"
            className={cn("text-[10px]", sourceMeta.className)}
          >
            {sourceMeta.label}
          </Badge>
        </div>
      )}
      {source === "none" ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          No response payload available. Run the flow, or this endpoint has no
          documented response schema.
        </p>
      ) : (
        <LiveJsonTree
          value={body}
          variant={variant}
          hideRoot
          onPick={onPick}
          keyPathToAccessor={keyPathToAccessor}
          emptyMessage="No response payload"
        />
      )}
    </div>
  );
}

type PayloadPickerProps = {
  body: unknown;
  source: PayloadSource;
  onPick: (path: string, preview: string) => void;
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  title?: string;
};

export function PayloadPicker({
  body,
  source,
  onPick,
  trigger,
  align = "end",
  title = "Pick a field",
}: PayloadPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align={align}>
        <PayloadTreeView
          body={body}
          source={source}
          title={title}
          variant="compact"
          onPick={(path, preview) => {
            onPick(path, preview);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
