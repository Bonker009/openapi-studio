"use client";

import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

type JsonBodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  className?: string;
  "aria-labelledby"?: string;
};

function JsonBodyEditorFallback({
  value,
  onChange,
  minHeight = "220px",
  className,
  "aria-labelledby": ariaLabelledBy,
}: JsonBodyEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-md border border-input bg-card p-3 font-mono text-xs text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      style={{ minHeight }}
      spellCheck={false}
      aria-label={ariaLabelledBy ? undefined : "Request body (JSON)"}
      aria-labelledby={ariaLabelledBy}
    />
  );
}

const JsonBodyEditorInner = lazy(() =>
  import("@/components/playground/json-body-editor").then((m) => ({
    default: m.JsonBodyEditor,
  }))
);

export function JsonBodyEditorLazy(props: JsonBodyEditorProps) {
  return (
    <Suspense fallback={<JsonBodyEditorFallback {...props} />}>
      <JsonBodyEditorInner {...props} />
    </Suspense>
  );
}
