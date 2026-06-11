import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Booleans and null — red in light mode, light pink in dark mode. */
const JSON_LITERAL_LIGHT = "#c2410c";
const JSON_LITERAL_DARK = "#f9a8d4";

const fontFamily =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** Visible blue selection — dark theme previously used #1e3a5f, too close to the editor bg. */
const SELECTION_BLUE = "#2563eb";

const selectionStyles = {
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground":
    {
      backgroundColor: `${SELECTION_BLUE} !important`,
    },
  ".cm-content ::selection": {
    backgroundColor: `${SELECTION_BLUE} !important`,
    color: "#ffffff !important",
  },
};

const sharedTheme = {
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    fontFamily,
    padding: "12px 0",
  },
  ...selectionStyles,
};

export const codeMirrorThemeLight: Extension = EditorView.theme(
  {
    ...sharedTheme,
    "&": {
      backgroundColor: "#ffffff",
      color: "#1e293b",
      fontSize: "12px",
    },
    ".cm-content": {
      ...sharedTheme[".cm-content"],
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
    ".cm-cursor": {
      borderLeftColor: "#0f172a",
    },
    ".cm-string": { color: "#0f766e" },
    ".cm-number": { color: "#6d28d9" },
    ".cm-atom": { color: JSON_LITERAL_LIGHT },
    ".cm-propertyName": { color: "#475569" },
    ".cm-punctuation": { color: "#64748b" },
    ".cm-null": { color: JSON_LITERAL_LIGHT },
    ".cm-bool": { color: JSON_LITERAL_LIGHT },
  },
  { dark: false },
);

export const codeMirrorThemeDark: Extension = EditorView.theme(
  {
    ...sharedTheme,
    "&": {
      backgroundColor: "#1e293b !important",
      color: "#e2e8f0",
      fontSize: "12px",
    },
    ".cm-scroller": {
      backgroundColor: "#1e293b",
    },
    ".cm-content": {
      ...sharedTheme[".cm-content"],
      backgroundColor: "#1e293b",
      caretColor: "#f1f5f9",
    },
    ".cm-gutters": {
      backgroundColor: "#334155",
      color: "#64748b",
      borderRight: "1px solid oklch(1 0 0 / 10%)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(59, 130, 246, 0.12)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(59, 130, 246, 0.08)",
    },
    ".cm-cursor": {
      borderLeftColor: "#f1f5f9",
    },
    ".cm-string": { color: "#2dd4bf" },
    ".cm-number": { color: "#a78bfa" },
    ".cm-atom": { color: JSON_LITERAL_DARK },
    ".cm-propertyName": { color: "#cbd5e1" },
    ".cm-punctuation": { color: "#94a3b8" },
    ".cm-null": { color: JSON_LITERAL_DARK },
    ".cm-bool": { color: JSON_LITERAL_DARK },
  },
  { dark: true },
);

/** @deprecated use getCodeMirrorTheme */
export const codeMirrorTheme = codeMirrorThemeLight;

export function getCodeMirrorTheme(isDark: boolean): Extension {
  return isDark ? codeMirrorThemeDark : codeMirrorThemeLight;
}

const jsonHighlightLight = HighlightStyle.define([
  { tag: t.string, color: "#0f766e" },
  { tag: t.number, color: "#6d28d9" },
  { tag: [t.bool, t.null, t.atom, t.keyword], color: JSON_LITERAL_LIGHT },
  { tag: t.propertyName, color: "#475569" },
  { tag: [t.punctuation, t.bracket], color: "#64748b" },
]);

const jsonHighlightDark = HighlightStyle.define([
  { tag: t.string, color: "#2dd4bf" },
  { tag: t.number, color: "#a78bfa" },
  { tag: [t.bool, t.null, t.atom, t.keyword], color: JSON_LITERAL_DARK },
  { tag: t.propertyName, color: "#cbd5e1" },
  { tag: [t.punctuation, t.bracket], color: "#94a3b8" },
]);

export function getJsonSyntaxHighlighting(isDark: boolean): Extension {
  return syntaxHighlighting(isDark ? jsonHighlightDark : jsonHighlightLight);
}

export const editorSurfaceClassName =
  "rounded-md border border-input overflow-hidden bg-card";

export const editorTextareaClassName =
  "w-full rounded-md border border-input bg-card p-3 font-mono text-xs text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
