"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import type { ErdPasteFormat } from "@/domain/db/erd-paste-schema";
import { getErdPasteFormatMeta } from "@/domain/db/erd-paste-schema";
import { cn } from "@/lib/utils";

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "hsl(var(--card))",
    fontSize: "13px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    padding: "12px 0",
    caretColor: "hsl(var(--foreground))",
  },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--muted) / 0.4)",
    color: "hsl(var(--muted-foreground))",
    borderRight: "1px solid hsl(var(--border))",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--muted) / 0.6)",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--muted) / 0.3)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.15) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--foreground))",
  },
});

type ErdSchemaEditorProps = {
  value: string;
  onChange: (value: string) => void;
  format: ErdPasteFormat;
  className?: string;
  minHeight?: string;
};

function languageExtension(format: ErdPasteFormat) {
  switch (format) {
    case "postgres":
      return sql({ dialect: PostgreSQL });
    case "drizzle":
      return javascript({ typescript: true });
    case "prisma":
    default:
      return [];
  }
}

export function ErdSchemaEditor({
  value,
  onChange,
  format,
  className,
  minHeight = "420px",
}: ErdSchemaEditorProps) {
  const placeholder = getErdPasteFormatMeta(format).placeholder;

  const extensions = useMemo(
    () => [
      editorTheme,
      languageExtension(format),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      EditorView.lineWrapping,
      keymap.of([...closeBracketsKeymap, indentWithTab]),
    ],
    [format]
  );

  return (
    <div
      className={cn(
        "rounded-md border border-input overflow-hidden bg-card",
        className
      )}
    >
      <CodeMirror
        value={value}
        height={minHeight}
        extensions={extensions}
        onChange={onChange}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
        }}
      />
    </div>
  );
}
