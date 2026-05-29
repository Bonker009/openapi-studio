"use client";

import { useCallback, useMemo, useState } from "react";
import { JSONTree } from "react-json-tree";
import { Check, ChevronDown, ChevronUp, Copy, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormattedJsonCode } from "@/components/playground/formatted-json-code";
import { useJsonTreeTheme } from "@/components/playground/use-json-tree-theme";
import {
  countJsonNodes,
  JSON_TREE_AUTO_EXPAND_NODE_LIMIT,
} from "@/lib/playground/count-json-nodes";
import {
  byteSizeLabel,
  formatResponseBodyForDisplay,
  isJsonTreeValue,
} from "@/lib/playground/json-format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function subtreeMatchesSearch(value: unknown, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (value === null || value === undefined) {
    return String(value).toLowerCase().includes(q);
  }
  if (typeof value !== "object") {
    return String(value).toLowerCase().includes(q);
  }
  if (Array.isArray(value)) {
    return value.some((item) => subtreeMatchesSearch(item, q));
  }
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) =>
      key.toLowerCase().includes(q) || subtreeMatchesSearch(child, q)
  );
}

function valueToneClass(raw: unknown): string {
  if (raw === null) return "text-muted-foreground italic";
  if (typeof raw === "boolean") return "text-[var(--json-bool)]";
  if (typeof raw === "number") return "text-[var(--json-number)] tabular-nums";
  if (typeof raw === "string") return "text-[var(--json-string)]";
  return "text-foreground";
}

export type LiveJsonTreeProps = {
  value: unknown;
  className?: string;
  variant?: "compact" | "panel" | "minimal";
  hideRoot?: boolean;
  onPick?: (path: string, preview: string) => void;
  keyPathToAccessor?: (keyPath: readonly (string | number)[]) => string;
  emptyMessage?: string;
};

function shortPreview(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    return value.length > 48 ? `${value.slice(0, 48)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const s = JSON.stringify(value);
    return s.length > 48 ? `${s.slice(0, 48)}…` : s;
  } catch {
    return String(value);
  }
}

function JsonTreeBody({
  value,
  hideRoot,
  expandNode,
  treeKey,
  pickable,
  onPick,
  keyPathToAccessor,
  theme,
  compact,
}: {
  value: unknown;
  hideRoot: boolean;
  expandNode: (
    keyPath: readonly (string | number)[],
    data: unknown,
    level: number
  ) => boolean;
  treeKey: string;
  pickable: boolean;
  onPick?: (path: string, preview: string) => void;
  keyPathToAccessor?: (keyPath: readonly (string | number)[]) => string;
  theme: ReturnType<typeof useJsonTreeTheme>;
  compact?: boolean;
}) {
  const labelRenderer = pickable
    ? (
        keyPath: readonly (string | number)[],
        _nodeType: string,
        _expanded: boolean,
        expandable: boolean
      ) => {
        const path = keyPathToAccessor!(keyPath);
        return (
          <button
            type="button"
            className={cn(
              "json-tree-pick rounded-sm px-0.5 -mx-0.5 font-medium text-[var(--json-key)]",
              "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              !expandable && "opacity-90"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onPick!(path, "");
            }}
            title={path ? `Pick ${path}` : "Pick field"}
          >
            {String(keyPath[0])}:
          </button>
        );
      }
    : undefined;

  const valueRenderer = pickable
    ? (display: unknown, raw: unknown, ...keyPath: (string | number)[]) => {
        const path = keyPathToAccessor!(keyPath);
        return (
          <button
            type="button"
            className={cn(
              "json-tree-pick rounded-sm px-0.5 -mx-0.5 text-left break-all",
              "hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              valueToneClass(raw)
            )}
            onClick={(e) => {
              e.stopPropagation();
              onPick!(path, shortPreview(raw));
            }}
            title={path ? `Pick ${path}` : "Pick value"}
          >
            {typeof display === "string" ? display : String(display)}
          </button>
        );
      }
    : undefined;

  return (
    <JSONTree
      key={treeKey}
      data={value}
      theme={theme}
      invertTheme={false}
      hideRoot={hideRoot}
      shouldExpandNodeInitially={expandNode}
      getItemString={(_type, _data, _itemType, itemString) => (
        <span className="ml-1 text-[11px] text-muted-foreground/90 font-normal">
          {itemString}
        </span>
      )}
      labelRenderer={labelRenderer}
      valueRenderer={valueRenderer}
      collectionLimit={compact ? 80 : 120}
    />
  );
}

export function LiveJsonTree({
  value,
  className,
  variant = "compact",
  hideRoot = true,
  onPick,
  keyPathToAccessor,
  emptyMessage = "No JSON to display",
}: LiveJsonTreeProps) {
  const theme = useJsonTreeTheme();
  const [search, setSearch] = useState("");
  const [expandAll, setExpandAll] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const isTree = isJsonTreeValue(value);
  const formatted = useMemo(
    () => formatResponseBodyForDisplay(value) ?? "",
    [value]
  );
  const nodeCount = useMemo(
    () =>
      isTree ? countJsonNodes(value, JSON_TREE_AUTO_EXPAND_NODE_LIMIT + 1) : 0,
    [value, isTree]
  );
  const autoExpandSmall = nodeCount <= JSON_TREE_AUTO_EXPAND_NODE_LIMIT;
  const pickable = !!onPick && !!keyPathToAccessor;

  const copyJson = useCallback(async () => {
    if (!formatted) return;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success("JSON copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }, [formatted]);

  const expandNode = useMemo(() => {
    const q = search.trim();
    if (expandAll) return () => true;
    if (q) {
      return (_keyPath: readonly (string | number)[], data: unknown) =>
        subtreeMatchesSearch(data, q);
    }
    if (autoExpandSmall) return () => true;
    return (
      _keyPath: readonly (string | number)[],
      _data: unknown,
      level: number
    ) => level <= 2;
  }, [expandAll, search, autoExpandSmall]);

  const treeKey = `${expandAll}-${search}-${autoExpandSmall}-${pickable}`;

  if (!isTree) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/30 p-4",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {formatted ? (
          <div className="mt-3 overflow-auto rounded-md border border-border/60 bg-card p-3">
            <FormattedJsonCode code={formatted} />
          </div>
        ) : null}
      </div>
    );
  }

  const maxH =
    variant === "panel"
      ? "max-h-[min(480px,55vh)]"
      : variant === "minimal"
        ? "max-h-36"
        : "max-h-80";

  const treeBlock = (
    <div className="json-tree-root">
      <JsonTreeBody
        value={value}
        hideRoot={hideRoot}
        expandNode={expandNode}
        treeKey={treeKey}
        pickable={pickable}
        onPick={onPick}
        keyPathToAccessor={keyPathToAccessor}
        theme={theme}
        compact={variant === "minimal"}
      />
    </div>
  );

  if (variant === "minimal") {
    return (
      <ScrollArea className={cn(maxH, className)}>
        <div className="json-tree-panel-inner p-2 text-[11px]">{treeBlock}</div>
      </ScrollArea>
    );
  }

  return (
    <div className={cn("json-tree-panel flex flex-col overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="relative min-w-[140px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search JSON…"
            className="h-8 border-border/80 bg-background pl-8 pr-8 text-xs"
            aria-label="Search JSON"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div
          className="flex h-8 shrink-0 items-center rounded-md border border-border bg-background p-0.5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              !showRaw
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setShowRaw(false)}
          >
            Tree
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              showRaw
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setShowRaw(true)}
          >
            Raw
          </button>
        </div>

        {!showRaw && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-[11px]"
            onClick={() => setExpandAll((v) => !v)}
          >
            {expandAll ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {expandAll ? "Collapse" : "Expand"}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2.5 text-[11px]"
          onClick={() => void copyJson()}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy
        </Button>
      </div>

      <div className="flex items-center gap-3 border-b border-border/60 bg-card/50 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{nodeCount} fields</span>
        {formatted ? (
          <span className="tabular-nums">{byteSizeLabel(formatted)}</span>
        ) : null}
        {pickable ? (
          <span className="ml-auto truncate text-primary/80">
            Click a field to capture its path
          </span>
        ) : null}
      </div>

      <ScrollArea className={maxH}>
        <div className="json-tree-panel-inner p-3">
          {showRaw ? (
            <div className="overflow-auto rounded-md border border-border/60 bg-[var(--json-panel-bg)] p-3">
              <FormattedJsonCode code={formatted} />
            </div>
          ) : (
            treeBlock
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
