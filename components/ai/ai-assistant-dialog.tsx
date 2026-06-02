"use client";

import { Sparkles } from "lucide-react";
import type { Flow } from "@/domain/flows/types";
import { AiAssistantContent } from "@/components/ai/ai-assistant-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AiAssistantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specId: string;
  defaultBaseUrl?: string;
  onApplyGeneratedFlow?: (flow: Flow) => void;
};

export function AiAssistantDialog({
  open,
  onOpenChange,
  specId,
  defaultBaseUrl,
  onApplyGeneratedFlow,
}: AiAssistantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[min(90vh,800px)] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </DialogTitle>
          <DialogDescription>
            Index OpenAPI, generate test flows, or ask grounded documentation
            questions without leaving this page.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 flex-1 min-h-0 overflow-hidden">
          <AiAssistantContent
            specId={specId}
            defaultBaseUrl={defaultBaseUrl}
            onApplyGeneratedFlow={onApplyGeneratedFlow}
            className="h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
