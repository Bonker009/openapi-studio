"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  getCodeMirrorTheme,
  getJsonSyntaxHighlighting,
  editorSurfaceClassName,
} from "@/lib/playground/codemirror-theme";
import { cn } from "@/lib/utils";

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
  const dark = useDarkMode();

  const theme = useMemo(() => getCodeMirrorTheme(dark), [dark]);

  const extensions = useMemo(
    () => [
      json(),
      getJsonSyntaxHighlighting(dark),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      EditorView.lineWrapping,
      keymap.of([...closeBracketsKeymap, indentWithTab]),
    ],
    [dark]
  );

  return (
    <div className={cn(editorSurfaceClassName, "json-body-editor", className)}>
      <CodeMirror
        key={dark ? "dark" : "light"}
        value={value}
        height={minHeight}
        theme={theme}
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
