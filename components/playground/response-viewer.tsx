"use client";

import { useMemo, useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonResponseView } from "@/components/playground/json-response-view";
import {
  byteSizeLabel,
  formatJsonBody,
  isJsonTreeValue,
  parseJsonValue,
} from "@/lib/playground/json-format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type BodyView = "tree" | "raw";

function RawBodyBlock({ code }: { code: string }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 overflow-hidden">
      <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground">
        {code}
      </pre>
    </div>
  );
}

type ResponseViewerProps = {
  status: number | null;
  responseTime: number | null;
  body: string;
  headers: Record<string, string>;
  placeholder?: string;
  embedded?: boolean;
};

function statusVariant(code: number | null) {
  if (code == null) return "";
  if (code >= 200 && code < 300)
    return "bg-teal-50 text-teal-800 border-teal-200";
  if (code >= 400)
    return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export function ResponseViewer({
  status,
  responseTime,
  body,
  headers,
  placeholder = "Execute a request to see the response",
  embedded = false,
}: ResponseViewerProps) {
  const [showHeaders, setShowHeaders] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bodyView, setBodyView] = useState<BodyView>("tree");

  const copyBody = async () => {
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      toast.success("Response copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const hasBody = Boolean(body.trim());
  const isPlaceholder = !hasBody;

  const displayBody = useMemo(() => {
    if (!hasBody) return placeholder;
    return formatJsonBody(body.trim()) ?? body;
  }, [body, hasBody, placeholder]);

  const parsedBody = useMemo(() => {
    if (!hasBody) return null;
    return parseJsonValue(body);
  }, [body, hasBody]);

  const canShowTree = isJsonTreeValue(parsedBody);

  const headersParsed = useMemo(
    () => (Object.keys(headers).length > 0 ? headers : null),
    [headers]
  );

  const effectiveView: BodyView =
    bodyView === "tree" && canShowTree ? "tree" : "raw";

  return (
    <div
      className={cn(
        "flex flex-col flex-1 min-h-0 bg-white",
        !embedded && "border-t border-border"
      )}
    >
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-white">
        {!embedded && (
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Response
          </span>
        )}
        {status != null && (
          <Badge
            variant="outline"
            className={cn("tabular-nums text-xs", statusVariant(status))}
          >
            {status}
          </Badge>
        )}
        {responseTime != null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {responseTime} ms
          </span>
        )}
        {hasBody && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {byteSizeLabel(body)}
          </span>
        )}

        {hasBody && canShowTree && (
          <div className="flex items-center rounded-md border border-border p-0.5 h-7">
            <Button
              type="button"
              variant={effectiveView === "tree" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-[10px] rounded-sm"
              onClick={() => setBodyView("tree")}
            >
              Tree
            </Button>
            <Button
              type="button"
              variant={effectiveView === "raw" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-[10px] rounded-sm"
              onClick={() => setBodyView("raw")}
            >
              Raw
            </Button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {headersParsed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowHeaders((v) => !v)}
            >
              Headers
              {showHeaders ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </Button>
          )}
          {hasBody && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={copyBody}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copy
            </Button>
          )}
        </div>
      </div>

      {showHeaders && headersParsed && (
        <div className="shrink-0 border-b border-border px-3 py-2 bg-white max-h-52 overflow-y-auto">
          <JsonResponseView value={headersParsed} />
        </div>
      )}

      <ScrollArea className="flex-1 min-h-[200px] bg-white">
        <div className="p-3 min-h-[200px]">
          {isPlaceholder ? (
            <p className="text-xs text-muted-foreground text-center py-12">
              {displayBody}
            </p>
          ) : effectiveView === "tree" && canShowTree ? (
            <JsonResponseView value={parsedBody} />
          ) : (
            <RawBodyBlock code={displayBody} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
