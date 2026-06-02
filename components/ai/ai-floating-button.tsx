"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Flow } from "@/domain/flows/types";
import { AiAssistantSheet } from "@/components/ai/ai-assistant-sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type AiFloatingButtonProps = {
  specId: string;
  defaultBaseUrl?: string;
  onApplyGeneratedFlow?: (flow: Flow) => void;
  className?: string;
};

export function AiFloatingButton({
  specId,
  defaultBaseUrl,
  onApplyGeneratedFlow,
  className,
}: AiFloatingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            aria-label="Open AI Assistant"
            className={cn(
              "fixed z-40 h-14 w-14 rounded-full shadow-lg",
              "bottom-6 right-6 pb-[env(safe-area-inset-bottom)]",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              className
            )}
            onClick={() => setOpen(true)}
          >
            <Sparkles className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">AI Assistant</TooltipContent>
      </Tooltip>

      <AiAssistantSheet
        open={open}
        onOpenChange={setOpen}
        specId={specId}
        defaultBaseUrl={defaultBaseUrl}
        onApplyGeneratedFlow={onApplyGeneratedFlow}
      />
    </>
  );
}
