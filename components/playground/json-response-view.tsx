"use client";

import { useMemo } from "react";
import { JSONTree } from "react-json-tree";
import {
  countJsonNodes,
  JSON_TREE_AUTO_EXPAND_NODE_LIMIT,
} from "@/lib/playground/count-json-nodes";
import { useJsonTreeTheme } from "@/components/playground/use-json-tree-theme";
import { cn } from "@/lib/utils";

type JsonResponseViewProps = {
  value: Record<string, unknown> | unknown[];
  className?: string;
  expandAll?: boolean;
};

export function JsonResponseView({
  value,
  className,
  expandAll = false,
}: JsonResponseViewProps) {
  const theme = useJsonTreeTheme();

  const autoExpandSmall = useMemo(() => {
    const count = countJsonNodes(
      value,
      JSON_TREE_AUTO_EXPAND_NODE_LIMIT + 1
    );
    return count <= JSON_TREE_AUTO_EXPAND_NODE_LIMIT;
  }, [value]);

  const shouldExpandNodeInitially = useMemo(() => {
    if (expandAll) return () => true;
    if (autoExpandSmall) return () => true;
    return (
      _keyPath: readonly (string | number)[],
      _data: unknown,
      level: number
    ) => level <= 2;
  }, [expandAll, autoExpandSmall]);

  return (
    <div
      role="region"
      aria-label="Response body"
      className={cn(
        "json-tree-root overflow-auto rounded-lg border border-border bg-[var(--json-panel-bg)] p-3 font-mono text-[13px] leading-relaxed",
        className
      )}
    >
      <JSONTree
        key={
          expandAll
            ? "expand-all"
            : autoExpandSmall
              ? "expand-small"
              : "expand-partial"
        }
        data={value}
        theme={theme}
        invertTheme={false}
        hideRoot={false}
        shouldExpandNodeInitially={shouldExpandNodeInitially}
        getItemString={(_type, _data, _itemType, itemString) => (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground/90">
            {itemString}
          </span>
        )}
      />
    </div>
  );
}
