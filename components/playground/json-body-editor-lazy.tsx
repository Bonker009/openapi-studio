"use client";

import { lazy, Suspense } from "react";
import {
  editorSurfaceClassName,
  editorTextareaClassName,
} from "@/lib/playground/codemirror-theme";
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
    <div className={cn(editorSurfaceClassName, "json-body-editor", className)}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(editorTextareaClassName, "min-h-0 border-0 shadow-none")}
        style={{ minHeight }}
        spellCheck={false}
        aria-label={ariaLabelledBy ? undefined : "Request body (JSON)"}
        aria-labelledby={ariaLabelledBy}
      />
    </div>
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
