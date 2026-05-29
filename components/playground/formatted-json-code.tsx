"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormattedJsonCodeProps = {
  code: string;
  className?: string;
};

/** Lightweight syntax-highlighted JSON for raw view (no extra dependency). */
export function FormattedJsonCode({ code, className }: FormattedJsonCodeProps) {
  const lines = useMemo(() => code.split("\n"), [code]);

  return (
    <pre
      className={cn(
        "m-0 font-mono text-[13px] leading-[1.65] whitespace-pre",
        className
      )}
    >
      {lines.map((line, i) => (
        <span key={i} className="block hover:bg-foreground/[0.03] px-0.5 -mx-0.5 rounded-sm">
          <HighlightedLine line={line} />
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </pre>
  );
}

function HighlightedLine({ line }: { line: string }) {
  if (!line.trim()) return <span>{line}</span>;

  const parts: ReactNode[] = [];
  let rest = line;
  let key = 0;

  const push = (text: string, className: string) => {
    if (!text) return;
    parts.push(
      <span key={key++} className={className}>
        {text}
      </span>
    );
  };

  while (rest.length > 0) {
    const ws = rest.match(/^(\s+)/);
    if (ws) {
      push(ws[1], "");
      rest = rest.slice(ws[1].length);
      continue;
    }

    const keyMatch = rest.match(/^"([^"\\]|\\.)*"(?=\s*:)/);
    if (keyMatch) {
      push(keyMatch[0], "text-[var(--json-key,#334155)] font-medium");
      rest = rest.slice(keyMatch[0].length);
      continue;
    }

    const strMatch = rest.match(/^"([^"\\]|\\.)*"/);
    if (strMatch) {
      push(strMatch[0], "text-[var(--json-string,#0d9488)]");
      rest = rest.slice(strMatch[0].length);
      continue;
    }

    const numMatch = rest.match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numMatch) {
      push(numMatch[0], "text-[var(--json-number,#7c3aed)]");
      rest = rest.slice(numMatch[0].length);
      continue;
    }

    const boolNull = rest.match(/^(true|false|null)\b/);
    if (boolNull) {
      push(
        boolNull[0],
        boolNull[0] === "null"
          ? "text-muted-foreground italic"
          : "text-[var(--json-bool,#c2410c)]"
      );
      rest = rest.slice(boolNull[0].length);
      continue;
    }

    const punct = rest.match(/^[{}\[\],:]/);
    if (punct) {
      push(punct[0], "text-muted-foreground/80");
      rest = rest.slice(1);
      continue;
    }

    push(rest[0], "text-foreground");
    rest = rest.slice(1);
  }

  return <>{parts}</>;
}
