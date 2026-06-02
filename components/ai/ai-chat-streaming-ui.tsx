"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AiStreamPhase =
  | "idle"
  | "connecting"
  | "retrieving"
  | "generating"
  | "streaming";

export function streamPhaseLabel(phase: AiStreamPhase): string {
  switch (phase) {
    case "connecting":
      return "Connecting to AI…";
    case "retrieving":
      return "Searching your OpenAPI spec…";
    case "generating":
      return "Preparing answer…";
    case "streaming":
      return "Writing answer…";
    default:
      return "";
  }
}

type AiChatTypingIndicatorProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

export function AiChatTypingIndicator({
  label,
  className,
  size = "sm",
}: AiChatTypingIndicatorProps) {
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <div
      className={cn("flex items-center gap-2.5", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "rounded-full bg-primary/80 animate-bounce",
              dot
            )}
            style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.9s" }}
          />
        ))}
      </span>
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}

export function AiChatStreamCursor({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-0.5 h-[1.05em] ml-0.5 align-text-bottom rounded-full bg-primary ai-chat-stream-cursor",
        className
      )}
      aria-hidden
    />
  );
}

type AiChatComposerStatusProps = {
  phase: AiStreamPhase;
  className?: string;
};

export function AiChatComposerStatus({
  phase,
  className,
}: AiChatComposerStatusProps) {
  if (phase === "idle") return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      <span className="text-xs font-medium text-foreground">
        {streamPhaseLabel(phase)}
      </span>
    </div>
  );
}

type AiOperationLoadingProps = {
  title: string;
  description?: string;
  className?: string;
};

/** Inline loading panel for non-streaming AI operations (index, flow). */
export function AiOperationLoading({
  title,
  description,
  className,
}: AiOperationLoadingProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-primary/15 bg-muted/30 p-4 space-y-3",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      {description ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      ) : null}
      <div className="space-y-2" aria-hidden>
        <div className="h-2 w-full rounded-md bg-muted animate-pulse" />
        <div className="h-2 w-4/5 rounded-md bg-muted animate-pulse [animation-delay:120ms]" />
        <div className="h-2 w-3/5 rounded-md bg-muted animate-pulse [animation-delay:240ms]" />
      </div>
    </div>
  );
}
