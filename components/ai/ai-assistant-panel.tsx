"use client";

import { Sparkles } from "lucide-react";
import { AiAssistantContent } from "@/components/ai/ai-assistant-content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Inline card variant (legacy); prefer AiFloatingButton + AiAssistantDialog in playground/flows. */
export function AiAssistantPanel({
  specId,
  defaultBaseUrl,
}: {
  specId: string;
  defaultBaseUrl?: string;
}) {
  return (
    <Card className="mb-6">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Assistant
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Index the spec once, then generate validated flows or ask grounded
              documentation questions.
            </p>
          </div>
          <Badge variant="outline">Ready</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <AiAssistantContent specId={specId} defaultBaseUrl={defaultBaseUrl} />
      </CardContent>
    </Card>
  );
}
