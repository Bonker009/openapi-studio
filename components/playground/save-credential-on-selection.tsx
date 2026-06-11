"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CredentialAddForm,
  type CredentialAddFormPrefill,
} from "@/components/playground/credential-add-form";
import {
  type Credential,
  getCredentials,
  setActiveCredentialId,
  setCredentials,
} from "@/lib/playground/credentials";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SaveCredentialOnSelectionProps = {
  specId: string;
  scopeSelector?: string;
  onActiveChange: (credential: Credential) => void;
};

type SelectionAnchor = {
  x: number;
  y: number;
  text: string;
};

const IGNORED_ANCESTORS =
  'input, textarea, select, button, [contenteditable="true"], .cm-editor, [data-no-credential-save]';

function inferPrefill(text: string): CredentialAddFormPrefill {
  const trimmed = text.trim();
  if (/^Bearer\s+/i.test(trimmed)) {
    return {
      type: "bearer",
      bearerToken: trimmed.replace(/^Bearer\s+/i, "").trim(),
    };
  }
  return {
    type: "bearer",
    bearerToken: trimmed,
  };
}

function readSelectionAtRightClick(
  container: Element,
  target: Node
): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) return null;

  if (!container.contains(target)) return null;

  try {
    if (!selection.containsNode(target, true)) return null;
  } catch {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rangeContainer = range.commonAncestorContainer;
  const element =
    rangeContainer.nodeType === Node.TEXT_NODE
      ? rangeContainer.parentElement
      : (rangeContainer as Element | null);
  if (!element) return null;

  if (element.closest(IGNORED_ANCESTORS)) return null;

  return text;
}

export function SaveCredentialOnSelection({
  specId,
  scopeSelector = "#main-content",
  onActiveChange,
}: SaveCredentialOnSelectionProps) {
  const [menuAnchor, setMenuAnchor] = useState<SelectionAnchor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setMenuAnchor(null);
    setShowForm(false);
  }, []);

  const handleSaved = useCallback(
    (credential: Credential) => {
      const next = [...getCredentials(specId), credential];
      setCredentials(specId, next);
      setActiveCredentialId(specId, credential.id);
      onActiveChange(credential);
      window.dispatchEvent(
        new CustomEvent("playground-credentials-updated", {
          detail: { specId },
        })
      );
      close();
      window.getSelection()?.removeAllRanges();
      toast.success(`Credential "${credential.name}" saved`);
    },
    [specId, onActiveChange, close]
  );

  const handleCopy = useCallback(async () => {
    if (!menuAnchor) return;
    try {
      await navigator.clipboard.writeText(menuAnchor.text);
      toast.success("Copied to clipboard");
      close();
    } catch {
      toast.error("Failed to copy");
    }
  }, [menuAnchor, close]);

  useEffect(() => {
    const container = document.querySelector(scopeSelector);
    if (!container) return;

    const onContextMenu = (event: Event) => {
      if (!(event instanceof MouseEvent)) return;
      if (popoverRef.current?.contains(event.target as Node)) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      const text = readSelectionAtRightClick(container, target);
      if (!text) return;

      event.preventDefault();
      event.stopPropagation();

      setShowForm(false);
      setMenuAnchor({
        text,
        x: event.clientX,
        y: event.clientY,
      });
    };

    container.addEventListener("contextmenu", onContextMenu);
    return () => container.removeEventListener("contextmenu", onContextMenu);
  }, [scopeSelector]);

  useEffect(() => {
    if (!menuAnchor) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (popoverRef.current?.contains(event.target as Node)) return;
      close();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuAnchor, close]);

  if (!menuAnchor) return null;

  const prefill = inferPrefill(menuAnchor.text);

  return (
    <div
      ref={popoverRef}
      data-no-credential-save
      className={cn(
        "fixed z-100 rounded-md border bg-popover text-popover-foreground shadow-lg",
        "animate-in fade-in-0 zoom-in-95",
        showForm ? "w-80 max-w-[calc(100vw-1rem)] p-3" : "min-w-[180px] py-1"
      )}
      style={{
        left: menuAnchor.x,
        top: menuAnchor.y,
        transform: "translate(8px, 8px)",
      }}
    >
      {showForm ? (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium">Save as credential</p>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                {menuAnchor.text.length > 48
                  ? `${menuAnchor.text.slice(0, 48)}…`
                  : menuAnchor.text}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={close}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <CredentialAddForm
            key={menuAnchor.text}
            prefill={prefill}
            onSubmit={handleSaved}
          />
        </>
      ) : (
        <div className="py-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
            onClick={() => void handleCopy()}
          >
            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Copy
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
            onClick={() => setShowForm(true)}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-primary" />
            Save as credential
          </button>
        </div>
      )}
    </div>
  );
}
