"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  Eye,
  Pencil,
  Columns2,
  Quote,
  Minus,
  ListChecks,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MarkdownSaveStatus = "idle" | "saving" | "saved";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
  saveStatus?: MarkdownSaveStatus;
};

type ViewMode = "write" | "preview" | "split";

const markdownPreviewClass =
  "markdown-body rounded-md border bg-card p-4 text-sm leading-relaxed text-foreground " +
  "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 " +
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 " +
  "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs " +
  "[&_pre]:my-3 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:overflow-x-auto " +
  "[&_pre>code]:bg-transparent [&_pre>code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:border [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted/50 [&_td]:border [&_td]:px-2 [&_td]:py-1 " +
  "[&_hr]:my-4 [&_hr]:border-border " +
  "[&_input[type=checkbox]]:mr-2";

function MarkdownPreview({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <div className={cn(markdownPreviewClass, className)}>
      {value.trim() ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      ) : (
        <p className="text-muted-foreground italic">Nothing to preview</p>
      )}
    </div>
  );
}

function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClick}
        >
          {children}
          <span className="sr-only">{title}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{title}</TooltipContent>
    </Tooltip>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write your notes here...",
  className = "",
  height = "min-h-[200px]",
  saveStatus = "idle",
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<ViewMode>("write");

  const insertText = useCallback(
    (before: string, after = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      const newText =
        value.substring(0, start) +
        before +
        selectedText +
        after +
        value.substring(end);
      onChange(newText);

      requestAnimationFrame(() => {
        textarea.focus();
        const cursor =
          selectedText.length > 0
            ? start + before.length + selectedText.length
            : start + before.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange]
  );

  const showToolbar = view === "write" || view === "split";
  const effectiveView =
    view === "split" ? "split" : view;

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : null;

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
          variant="outline"
          size="sm"
          className="justify-start"
        >
          <ToggleGroupItem value="write" aria-label="Write" className="gap-1.5 px-3">
            <Pencil className="h-3.5 w-3.5" />
            Write
          </ToggleGroupItem>
          <ToggleGroupItem value="preview" aria-label="Preview" className="gap-1.5 px-3">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </ToggleGroupItem>
          <ToggleGroupItem
            value="split"
            aria-label="Split view"
            className="gap-1.5 px-3 hidden lg:flex"
          >
            <Columns2 className="h-3.5 w-3.5" />
            Split
          </ToggleGroupItem>
        </ToggleGroup>

        {showToolbar && (
          <div className="flex flex-wrap items-center gap-0.5">
            <ToolbarButton title="Bold" onClick={() => insertText("**", "**")}>
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => insertText("*", "*")}>
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Inline code" onClick={() => insertText("`", "`")}>
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ToolbarButton title="Heading 1" onClick={() => insertText("# ")}>
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Heading 2" onClick={() => insertText("## ")}>
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Heading 3" onClick={() => insertText("### ")}>
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ToolbarButton title="Bullet list" onClick={() => insertText("- ")}>
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={() => insertText("1. ")}>
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Task list" onClick={() => insertText("- [ ] ")}>
              <ListChecks className="h-4 w-4" />
            </ToolbarButton>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ToolbarButton
              title="Code block"
              onClick={() => insertText("```\n", "\n```")}
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Blockquote" onClick={() => insertText("> ")}>
              <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Horizontal rule" onClick={() => insertText("\n---\n")}>
              <Minus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Link" onClick={() => insertText("[", "](url)")}>
              <Link className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton title="Image" onClick={() => insertText("![alt](", ")")}>
              <ImageIcon className="h-4 w-4" />
            </ToolbarButton>
          </div>
        )}
      </div>

      {effectiveView === "write" && (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("font-mono text-sm resize-y", height)}
        />
      )}

      {effectiveView === "preview" && (
        <MarkdownPreview value={value} className={cn(height, "overflow-y-auto")} />
      )}

      {effectiveView === "split" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn("font-mono text-sm resize-y", height)}
          />
          <MarkdownPreview value={value} className={cn(height, "overflow-y-auto")} />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{value.length.toLocaleString()} characters</span>
        {saveLabel && (
          <span
            role="status"
            aria-live="polite"
            className={cn(
              saveStatus === "saved" && "text-success",
              saveStatus === "saving" && "text-muted-foreground motion-safe:animate-pulse"
            )}
          >
            {saveLabel}
          </span>
        )}
      </div>
    </div>
  );
}
