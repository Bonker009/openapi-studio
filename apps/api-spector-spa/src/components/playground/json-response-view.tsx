"use client";

import { useMemo } from "react";
import { JSONTree } from "react-json-tree";
import {
  countJsonNodes,
  JSON_TREE_AUTO_EXPAND_NODE_LIMIT,
} from "@/lib/playground/count-json-nodes";
import { cn } from "@/lib/utils";

type JsonResponseViewProps = {
  value: Record<string, unknown> | unknown[];
  className?: string;
  /** When true, expand every node (user toggled "Expand all"). */
  expandAll?: boolean;
};

const treeTheme = {
  base00: "#f8fafc",
  base01: "#f1f5f9",
  base02: "#e2e8f0",
  base03: "#64748b",
  base04: "#94a3b8",
  base05: "#0f172a",
  base06: "#0f172a",
  base07: "#0f172a",
  base08: "#dc2626",
  base09: "#7c3aed",
  base0A: "#b45309",
  base0B: "#15803d",
  base0C: "#0e7490",
  base0D: "#1d4ed8",
  base0E: "#be185d",
  base0F: "#c2410c",
};

export function JsonResponseView({
  value,
  className,
  expandAll = false,
}: JsonResponseViewProps) {
  const autoExpandSmall = useMemo(() => {
    const count = countJsonNodes(
      value,
      JSON_TREE_AUTO_EXPAND_NODE_LIMIT + 1
    );
    return count <= JSON_TREE_AUTO_EXPAND_NODE_LIMIT;
  }, [value]);

  const shouldExpandNodeInitially = useMemo(() => {
    if (expandAll) {
      return () => true;
    }
    if (autoExpandSmall) {
      return () => true;
    }
    return (_keyPath: readonly (string | number)[], _data: unknown, level: number) =>
      level <= 2;
  }, [expandAll, autoExpandSmall]);

  return (
    <div
      role="region"
      aria-label="Response body"
      className={cn(
        "rounded-lg border border-border bg-muted/40 overflow-auto p-3 text-xs font-mono",
        className
      )}
    >
      <JSONTree
        key={expandAll ? "expand-all" : autoExpandSmall ? "expand-small" : "expand-partial"}
        data={value}
        theme={treeTheme}
        invertTheme={false}
        hideRoot={false}
        shouldExpandNodeInitially={shouldExpandNodeInitially}
        getItemString={(_type, _data, _itemType, itemString) => (
          <span className="text-muted-foreground text-[11px] ml-1">
            {itemString}
          </span>
        )}
        labelRenderer={([key], _nodeType, _expanded, expandable) => (
          <span
            className={cn(
              "font-medium",
              expandable ? "text-info" : "text-info/80"
            )}
          >
            {key}:
          </span>
        )}
        valueRenderer={(_display, raw) => (
          <span className="text-warning break-all whitespace-pre-wrap">
            {typeof raw === "string" ? JSON.stringify(raw) : String(raw)}
          </span>
        )}
      />
    </div>
  );
}
