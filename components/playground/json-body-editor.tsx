"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import { cn } from "@/lib/utils";

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    fontSize: "12px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    padding: "12px 0",
    caretColor: "#0f172a",
  },
  ".cm-gutters": {
    backgroundColor: "#fafafa",
    color: "#94a3b8",
    borderRight: "1px solid #e2e8f0",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#f1f5f9",
  },
  ".cm-activeLine": {
    backgroundColor: "#f8fafc",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#dbeafe !important",
  },
  ".cm-cursor": {
    borderLeftColor: "#0f172a",
  },
});

type JsonBodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  minHeight?: string;
  placeholder?: string;
};

export function JsonBodyEditor({
  value,
  onChange,
  className,
  minHeight = "200px",
  placeholder = "{\n  \n}",
}: JsonBodyEditorProps) {
  const extensions = useMemo(
    () => [
      editorTheme,
      json(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      EditorView.lineWrapping,
      keymap.of([...closeBracketsKeymap, indentWithTab]),
    ],
    []
  );

  return (
    <div
      className={cn(
        "rounded-md border border-input overflow-hidden bg-white",
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
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          indentOnInput: true,
        }}
      />
    </div>
  );
}
