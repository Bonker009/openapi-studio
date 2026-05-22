"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { isExpiringSoon, secondsUntilExpiry } from "@/lib/playground/token-utils";

const TOAST_ID = "playground-token-expiry";

/**
 * Warn via Sonner when the active JWT is within 5 minutes of expiry.
 * Checks immediately and every minute.
 */
export function useTokenExpiry(token: string | null) {
  useEffect(() => {
    if (!token) return;

    const check = () => {
      if (!isExpiringSoon(token, 300)) return;
      const secs = secondsUntilExpiry(token);
      if (secs === null || secs <= 0) return;
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
  }, [token]);
}
