"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Credential } from "@/lib/playground/credentials";
import { removeExpiredCredentials } from "@/lib/playground/credential-expiry";

const CHECK_INTERVAL_MS = 30_000;

function notifyRemovedCredentials(removed: Credential[]): void {
  if (removed.length === 1) {
    toast.success(`Removed expired credential "${removed[0].name}"`);
    return;
  }

  toast.success(`Removed ${removed.length} expired credentials`, {
    description: removed.map((c) => c.name).join(", "),
  });
}

type UseAutoRemoveExpiredCredentialsOptions = {
  onCredentialsChange: (remaining: Credential[]) => void;
  onActiveChange: (credential: Credential | null) => void;
};

export function useAutoRemoveExpiredCredentials(
  specId: string,
  { onCredentialsChange, onActiveChange }: UseAutoRemoveExpiredCredentialsOptions
) {
  const onCredentialsChangeRef = useRef(onCredentialsChange);
  const onActiveChangeRef = useRef(onActiveChange);

  onCredentialsChangeRef.current = onCredentialsChange;
  onActiveChangeRef.current = onActiveChange;

  useEffect(() => {
    const run = () => {
      const { removed, remaining, activeCredentialId } =
        removeExpiredCredentials(specId);

      onCredentialsChangeRef.current(remaining);

      const active = activeCredentialId
        ? (remaining.find((c) => c.id === activeCredentialId) ?? null)
        : null;
      onActiveChangeRef.current(active);

      if (removed.length === 0) return;

      notifyRemovedCredentials(removed);

      window.dispatchEvent(
        new CustomEvent("playground-credentials-updated", {
          detail: { specId },
        })
      );
    };

    run();
    const interval = setInterval(run, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [specId]);
}
