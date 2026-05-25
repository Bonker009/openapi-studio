"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CodeBlockProps = {
  code: string;
  language?: string;
  className?: string;
  maxHeight?: string;
};

export function CodeBlock({
  code,
  language = "json",
  className,
  maxHeight = "max-h-[min(480px,50vh)]",
}: CodeBlockProps) {
  const constrainHeight = maxHeight !== "max-h-none";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className={cn("relative rounded-md border overflow-hidden", className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute top-2 right-2 z-10 h-7 gap-1 px-2 shadow-sm"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
      <div
        className={cn(
          constrainHeight && cn("overflow-y-auto", maxHeight),
          !constrainHeight && "overflow-visible"
        )}
      >
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "0.8125rem",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
