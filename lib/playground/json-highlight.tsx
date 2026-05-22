import type { ReactNode } from "react";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Simple token colors for sample blocks in the Parameters tab only. */
export function highlightJsonText(raw: string): ReactNode[] {
  const text = raw || "";
  const parts = text.split(
    /("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)|([{}\[\],:])/
  );

  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('"')) {
      return (
        <span key={i} className="text-teal-700">
          {part}
        </span>
      );
    }
    if (/^-?\d/.test(part)) {
      return (
        <span key={i} className="text-violet-700">
          {part}
        </span>
      );
    }
    if (part === "true" || part === "false" || part === "null") {
      return (
        <span key={i} className="text-amber-700">
          {part}
        </span>
      );
    }
    if (/^[{}[\],:]$/.test(part)) {
      return (
        <span key={i} className="text-muted-foreground">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** @deprecated Use highlightJsonText only — unsafe with dangerouslySetInnerHTML */
export function highlightJsonHtml(raw: string): string {
  const text = escapeHtml(raw);
  return text
    .replace(/("(?:\\.|[^"\\])*")/g, '<span class="text-teal-700">$1</span>')
    .replace(
      /\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
      '<span class="text-violet-700">$1</span>'
    )
    .replace(
      /\b(true|false|null)\b/g,
      '<span class="text-amber-700">$1</span>'
    );
}
