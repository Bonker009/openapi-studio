"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { highlightJsonText } from "@/lib/playground/json-highlight";
import type { OperationSamples } from "@/lib/playground/generate-sample";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function statusVariant(code: string) {
  if (code.startsWith("2"))
    return "bg-teal-50 text-teal-800 border-teal-200";
  if (code.startsWith("4"))
    return "bg-destructive/10 text-destructive border-destructive/20";
  if (code.startsWith("5"))
    return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
}

function SampleBlock({
  title,
  code,
  mono = true,
}: {
  title: string;
  code: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-border">
        {title ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
          onClick={copy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy
        </Button>
      </div>
      <pre
        className={cn(
          "p-3 text-xs break-all whitespace-pre-wrap leading-relaxed max-h-[min(280px,40vh)] overflow-auto",
          mono && "font-mono"
        )}
      >
        {mono ? highlightJsonText(code) : code}
      </pre>
    </div>
  );
}

type OperationSamplesProps = {
  samples: OperationSamples | null;
};

export function OperationSamples({ samples }: OperationSamplesProps) {
  if (!samples) return null;

  const hasRequestBody = Boolean(samples.requestBody?.trim());
  const hasResponses = samples.responses.length > 0;

  if (!hasRequestBody && !hasResponses) {
    return (
      <div className="space-y-3 pt-4 border-t border-border">
        <SampleBlock title="Sample request URL" code={samples.requestUrl} mono={false} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <SampleBlock title="Sample request URL" code={samples.requestUrl} mono={false} />

      {hasRequestBody && (
        <SampleBlock
          title="Sample request body"
          code={samples.requestBody!}
        />
      )}

      {hasResponses && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sample responses
          </p>
          {samples.responses.map((r) => (
            <div key={r.code} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("tabular-nums text-xs", statusVariant(r.code))}
                >
                  {r.code}
                </Badge>
                {r.description && (
                  <span className="text-xs text-muted-foreground">
                    {r.description}
                  </span>
                )}
              </div>
              <SampleBlock title="" code={r.body} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
