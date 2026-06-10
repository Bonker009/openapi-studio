"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CopyCodeButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

export function CopyCodeButton({
  value,
  label = "Copy",
  className,
}: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? "h-7 gap-1 px-2 text-[11px]"}
      onClick={() => void copy()}
      aria-label={label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
