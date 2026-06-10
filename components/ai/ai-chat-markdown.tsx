"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { CopyCodeButton } from "@/components/ai/copy-code-button";

const chatMarkdownClass =
  "text-sm leading-relaxed break-words " +
  "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1:first-child]:mt-0 " +
  "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h2:first-child]:mt-0 " +
  "[&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_h3:first-child]:mt-0 " +
  "[&_p]:my-1.5 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs " +
  "[&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted/80 [&_pre]:p-0 " +
  "[&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:block [&_pre>code]:p-2.5 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground " +
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_table]:border [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted/50 [&_td]:border [&_td]:px-2 [&_td]:py-1 " +
  "[&_hr]:my-3 [&_hr]:border-border";

function PreBlock({
  children,
}: {
  children?: React.ReactNode;
}) {
  const child = children as { props?: { className?: string; children?: string } };
  const codeEl = child?.props;
  const className = codeEl?.className ?? "";
  const langMatch = /language-(\w+)/.exec(className);
  const lang = langMatch?.[1];
  const codeText = String(codeEl?.children ?? "").replace(/\n$/, "");

  return (
    <div className="relative my-2 rounded-md border bg-muted/80 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/60 px-2 py-1">
        <span className="text-[10px] font-mono uppercase text-muted-foreground">
          {lang ?? "code"}
        </span>
        <CopyCodeButton value={codeText} label="Copy" />
      </div>
      <pre className="m-0 overflow-x-auto p-0 bg-transparent border-0">
        {children}
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  pre: ({ children }) => <PreBlock>{children}</PreBlock>,
};

type AiChatMarkdownProps = {
  content: string;
  className?: string;
};

export function AiChatMarkdown({ content, className }: AiChatMarkdownProps) {
  if (!content.trim()) return null;

  return (
    <div className={cn(chatMarkdownClass, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
