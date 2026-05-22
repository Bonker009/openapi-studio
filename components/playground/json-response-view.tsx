"use client";

import { JSONTree } from "react-json-tree";
import { cn } from "@/lib/utils";

type JsonResponseViewProps = {
  value: Record<string, unknown> | unknown[];
  className?: string;
};

/** Postman-style tree — full values, all nodes expanded by default. */
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

export function JsonResponseView({ value, className }: JsonResponseViewProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-slate-50 overflow-auto p-3 text-xs font-mono",
        className
      )}
    >
      <JSONTree
        data={value}
        theme={treeTheme}
        invertTheme={false}
        hideRoot={false}
        shouldExpandNodeInitially={() => true}
        getItemString={(_type, _data, _itemType, itemString) => (
          <span className="text-muted-foreground text-[11px] ml-1">
            {itemString}
          </span>
        )}
        labelRenderer={([key], _nodeType, _expanded, expandable) => (
          <span
            className={cn(
              "font-medium",
              expandable ? "text-sky-800" : "text-sky-700"
            )}
          >
            {key}:
          </span>
        )}
        valueRenderer={(_display, raw) => (
          <span className="text-amber-900 break-all whitespace-pre-wrap">
            {typeof raw === "string" ? JSON.stringify(raw) : String(raw)}
          </span>
        )}
      />
    </div>
  );
}
