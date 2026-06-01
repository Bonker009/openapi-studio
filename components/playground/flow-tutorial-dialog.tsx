"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Braces,
  KeyRound,
  ListOrdered,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";

export type FlowTutorialDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canLoadSample?: boolean;
  onLoadSample?: () => void;
};

const STEPS = [
  {
    icon: Sparkles,
    title: "What are flow tests?",
    body: "Chain API calls in order—like a mini integration test. Each step can use data from earlier responses, and you can assert status codes along the way.",
  },
  {
    icon: Plus,
    title: "Add endpoints as steps",
    body: 'Click Add endpoint in the builder and pick routes from your spec. Reorder steps with the arrows, or wire them on the Diagram tab.',
  },
  {
    icon: ListOrdered,
    title: "Capture values from responses",
    body: 'On each step, add Captures (e.g. body path payload[0].id → variable productId). After a run, use Pick on the response tree to fill paths quickly.',
  },
  {
    icon: Braces,
    title: "Reference captures later",
    body: "Use {{vars.productId}} in path params, headers, or the request body. You can also reference prior steps with {{steps.0.body.field}}.",
  },
  {
    icon: KeyRound,
    title: "Auth from a login step",
    body: 'Mark a step as the login for this flow and capture its token. Downstream steps using Flow default auth automatically send Bearer token—no global credential or pause-and-resume.',
  },
  {
    icon: Play,
    title: "Run and debug",
    body: "Run flow runs all steps. Step through pauses after each step. Resume from failed reuses earlier results. Results tab shows pass/fail per step.",
  },
] as const;

export function FlowTutorialDialog({
  open,
  onOpenChange,
  canLoadSample = false,
  onLoadSample,
}: FlowTutorialDialogProps) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const Icon = step.icon;
  const isLast = index === STEPS.length - 1;

  const close = () => {
    onOpenChange(false);
    setIndex(0);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setIndex(0);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            How flow tests work
          </DialogTitle>
          <DialogDescription>
            Step {index + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2 text-primary">
            <Icon className="h-5 w-5 shrink-0" />
            <h3 className="text-sm font-semibold">{step.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.body}
          </p>

          <div className="flex justify-center gap-1.5 pt-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === index ? "bg-primary" : "bg-muted-foreground/30"
                )}
                aria-hidden
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="flex gap-2 w-full sm:w-auto">
            {canLoadSample && onLoadSample && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  onLoadSample();
                  close();
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Load example flow
              </Button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={close}
            >
              {isLast ? "Done" : "Skip"}
            </Button>
            {index > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setIndex((i) => i - 1)}
              >
                Back
              </Button>
            )}
            {!isLast ? (
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setIndex((i) => i + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={close}
              >
                Get started
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const flowTutorialStorageKey = (specId: string) =>
  `flow_tutorial_seen_${specId}`;

export function hasSeenFlowTutorial(specId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(flowTutorialStorageKey(specId)) === "1";
  } catch {
    return true;
  }
}

export function markFlowTutorialSeen(specId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(flowTutorialStorageKey(specId), "1");
  } catch {
    /* quota */
  }
}
