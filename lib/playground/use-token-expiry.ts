"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { isExpiringSoon } from "@/lib/playground/token-utils";

const TOAST_ID = "playground-token-expiry";

type TokenExpiryOptions = {
  /** JWT bearer token string */
  token?: string | null;
  /** Unix seconds expiry (OAuth2 client credentials) */
  expiresAt?: number | null;
};

/**
 * Warn via Sonner when the active credential is within 5 minutes of expiry.
 */
export function useTokenExpiry({ token, expiresAt }: TokenExpiryOptions) {
  useEffect(() => {
    const subject =
      expiresAt != null && expiresAt > 0
        ? expiresAt
        : token?.trim()
          ? token
          : null;
    if (!subject) return;

    const check = () => {
      if (!isExpiringSoon(subject, 300)) return;
      const secs =
        typeof subject === "number"
          ? subject - Math.floor(Date.now() / 1000)
          : null;
      if (secs === null) {
        toast.warning("Token expires soon", {
          id: TOAST_ID,
          description: "Refresh your token to avoid interruptions.",
          duration: 10_000,
        });
        return;
      }
      if (secs <= 0) return;
      const mins = Math.max(1, Math.ceil(secs / 60));
      toast.warning(`Token expires in ${mins} min`, {
        id: TOAST_ID,
        description: "Refresh your token to avoid interruptions.",
        duration: 10_000,
      });
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [token, expiresAt]);
}
