"use client";

import { Sparkles } from "lucide-react";
import type { Flow } from "@/domain/flows/types";
import { AiAssistantContent } from "@/components/ai/ai-assistant-content";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type AiAssistantSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specId: string;
  defaultBaseUrl?: string;
  onApplyGeneratedFlow?: (flow: Flow) => void;
};

export function AiAssistantSheet({
  open,
  onOpenChange,
  specId,
  defaultBaseUrl,
  onApplyGeneratedFlow,
}: AiAssistantSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </SheetTitle>
          <SheetDescription>
            Index OpenAPI, generate flows, or ask documentation questions with
            streaming answers.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-6 py-4">
          <AiAssistantContent
            specId={specId}
            defaultBaseUrl={defaultBaseUrl}
            onApplyGeneratedFlow={onApplyGeneratedFlow}
            className="h-full min-h-0"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
