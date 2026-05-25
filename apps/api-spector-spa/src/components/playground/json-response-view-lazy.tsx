"use client";

import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

type JsonResponseViewProps = {
  value: Record<string, unknown> | unknown[];
  className?: string;
  expandAll?: boolean;
};

function JsonTreeFallback({
  value,
  className,
}: Pick<JsonResponseViewProps, "value" | "className">) {
  const text =
    typeof value === "object"
      ? JSON.stringify(value, null, 2)
      : String(value);
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/40 overflow-auto p-3 text-xs font-mono",
        className
      )}
    >
      <pre className="whitespace-pre-wrap wrap-break-word text-foreground">
        {text}
      </pre>
    </div>
  );
}

const JsonResponseViewInner = lazy(() =>
  import("@/components/playground/json-response-view").then((m) => ({
    default: m.JsonResponseView,
  }))
);

export function JsonResponseViewLazy(props: JsonResponseViewProps) {
  return (
    <Suspense
      fallback={
        <JsonTreeFallback value={props.value} className={props.className} />
      }
    >
      <JsonResponseViewInner {...props} />
    </Suspense>
  );
}
