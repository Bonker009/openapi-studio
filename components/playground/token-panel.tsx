"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CredentialAddForm } from "@/components/playground/credential-add-form";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Credential,
  credentialRequiresAuth,
  getActiveCredentialId,
  getCredentials,
  setActiveCredentialId,
  setCredentials,
} from "@/lib/playground/credentials";
import {
  formatExpiryLabel,
  isExpired,
  isExpiringSoon,
} from "@/lib/playground/token-utils";
import {
  credentialNeedsRefresh,
  refreshCredential,
  TOKEN_REFRESH_LEAD_SECONDS,
} from "@/lib/playground/token-lifecycle";
import { useTokenExpiry } from "@/lib/playground/use-token-expiry";
import { useAutoRemoveExpiredCredentials } from "@/lib/playground/use-auto-remove-expired-credentials";
import { getCredentialExpirySubject } from "@/lib/playground/credential-expiry";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TokenPanelProps = {
  specId: string;
  activeCredential: Credential | null;
  onActiveChange: (credential: Credential | null) => void;
  variant?: "sidebar" | "navbar";
};

function expirySource(credential: Credential | null): string | number | null {
  if (!credential) return null;
  return getCredentialExpirySubject(credential);
}

export function TokenPanel({
  specId,
  activeCredential,
  onActiveChange,
  variant = "sidebar",
}: TokenPanelProps) {
  const isNavbar = variant === "navbar";
  const [credentials, setCredsState] = useState<Credential[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);

  const expirySubject = expirySource(activeCredential);
  useTokenExpiry({
    token: activeCredential?.type === "bearer" ? activeCredential.token : null,
    expiresAt:
      activeCredential?.type === "oauth2cc" ||
      activeCredential?.type === "oauth2rt"
        ? activeCredential.expiresAt
        : null,
  });

  const persist = useCallback(
    (next: Credential[]) => {
      setCredsState(next);
      setCredentials(specId, next);
    },
    [specId]
  );

  const selectCredential = useCallback(
    (id: string) => {
      const cred = credentials.find((c) => c.id === id);
      setActiveCredentialId(specId, id);
      onActiveChange(cred ?? null);
    },
    [credentials, specId, onActiveChange]
  );

  const clearCredential = useCallback(() => {
    setActiveCredentialId(specId, null);
    onActiveChange(null);
  }, [specId, onActiveChange]);

  const syncCredentials = useCallback((remaining: Credential[]) => {
    setCredsState(remaining);
  }, []);

  useAutoRemoveExpiredCredentials(specId, {
    onCredentialsChange: syncCredentials,
    onActiveChange,
  });

  useEffect(() => {
    const onCredentialsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ specId?: string }>).detail;
      if (detail?.specId !== specId) return;
      setCredsState(getCredentials(specId));
    };
    window.addEventListener("playground-credentials-updated", onCredentialsUpdated);
    return () =>
      window.removeEventListener(
        "playground-credentials-updated",
        onCredentialsUpdated
      );
  }, [specId]);

  useEffect(() => {
    if (!expirySubject) {
      setExpiryLabel(null);
      return;
    }
    const update = () => setExpiryLabel(formatExpiryLabel(expirySubject));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expirySubject]);

  useEffect(() => {
    if (!activeCredential) return;
    if (
      activeCredential.type !== "oauth2cc" &&
      activeCredential.type !== "oauth2rt"
    ) {
      return;
    }
    if (
      !credentialNeedsRefresh(activeCredential, TOKEN_REFRESH_LEAD_SECONDS)
    ) {
      return;
    }

    const cred = activeCredential;
    let cancelled = false;
    (async () => {
      try {
        const updated = await refreshCredential(specId, cred);
        if (cancelled) return;
        const next = credentials.map((c) => (c.id === cred.id ? updated : c));
        persist(next);
        if (getActiveCredentialId(specId) === cred.id) {
          onActiveChange(updated);
        }
      } catch {
        /* silent auto-refresh failure */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCredential, credentials, persist, specId, onActiveChange]);

  const addCredential = (cred: Credential) => {
    const next = [...credentials, cred];
    persist(next);
    selectCredential(cred.id);
    setShowAdd(false);
  };

  const removeCredential = (id: string) => {
    const next = credentials.filter((c) => c.id !== id);
    persist(next);
    if (activeCredential?.id === id) clearCredential();
  };

  const handleFetchOAuth = async (
    cred: Extract<Credential, { type: "oauth2cc" | "oauth2rt" }>
  ) => {
    setFetchingToken(true);
    try {
      const updated = await refreshCredential(specId, cred);
      const next = credentials.map((c) => (c.id === cred.id ? updated : c));
      persist(next);
      if (getActiveCredentialId(specId) === cred.id) {
        onActiveChange(updated);
      }
      toast.success(
        cred.type === "oauth2rt" ? "Token refreshed" : "Token fetched"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch token");
    } finally {
      setFetchingToken(false);
    }
  };

  const expiringSoon =
    expirySubject != null && isExpiringSoon(expirySubject, 300);
  const expired = expirySubject != null && isExpired(expirySubject);

  const expiryBadge = expiryLabel && (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] tabular-nums shrink-0 font-mono",
        expired && "bg-destructive/10 text-destructive border-destructive/20 motion-safe:animate-pulse",
        expiringSoon &&
          !expired &&
          "bg-warning/10 text-warning border-warning/30"
      )}
    >
      {expiryLabel}
    </Badge>
  );

  const addForm = <CredentialAddForm onSubmit={addCredential} />;

  const credManageList = credentials.length > 0 && (
    <ul className="space-y-1 border-t pt-2 mt-2 max-h-40 overflow-y-auto">
      {credentials.map((cred) => (
        <li
          key={cred.id}
          className="flex items-center justify-between gap-2 text-xs rounded-md px-2 py-1 bg-muted/40"
        >
          <button
            type="button"
            className="truncate font-medium text-left hover:underline min-w-0"
            onClick={() => selectCredential(cred.id)}
          >
            {cred.name}
            <span className="text-muted-foreground ml-1">({cred.type})</span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {(cred.type === "oauth2cc" || cred.type === "oauth2rt") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-[10px]"
                disabled={fetchingToken}
                onClick={() => handleFetchOAuth(cred)}
              >
                {fetchingToken ? (
                  <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                ) : (
                  "Fetch"
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeCredential(cred.id)}
              aria-label={`Remove ${cred.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );

  const selector = (
    <Select
      value={activeCredential?.id ?? "__none__"}
      onValueChange={(v) => (v === "__none__" ? clearCredential() : selectCredential(v))}
    >
      <Label htmlFor="cred-navbar-select" className="sr-only">
        Credential
      </Label>
      <SelectTrigger
        id="cred-navbar-select"
        className={isNavbar ? "h-8 w-[min(160px,36vw)] text-xs" : "w-full h-9 text-sm"}
      >
        <SelectValue placeholder="Credential" />
      </SelectTrigger>
      <SelectContent align={isNavbar ? "end" : "start"}>
        <SelectItem value="__none__">No auth</SelectItem>
        {credentials.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isNavbar) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <KeyRound className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
        {selector}
        {expiryBadge}
        {(activeCredential?.type === "oauth2cc" ||
          activeCredential?.type === "oauth2rt") && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 shrink-0 text-xs"
            disabled={fetchingToken}
            onClick={() => handleFetchOAuth(activeCredential)}
          >
            {fetchingToken ? <Loader2 className="h-3 w-3 motion-safe:animate-spin" /> : "Refresh"}
          </Button>
        )}
        <Popover open={showAdd} onOpenChange={setShowAdd}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">Auth</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end" data-no-credential-save>
            <p className="text-xs font-medium mb-2">Credentials</p>
            {addForm}
            {credManageList}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-b border-border pb-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary shrink-0" />
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Credentials
        </Label>
      </div>

      {credentials.length > 0 ? (
        selector
      ) : (
        <p className="text-xs text-muted-foreground">No credentials saved</p>
      )}

      {activeCredential && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {activeCredential.name} · {activeCredential.type}
          </Badge>
          {expiryBadge}
          {(activeCredential.type === "oauth2cc" ||
            activeCredential.type === "oauth2rt") && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              disabled={fetchingToken}
              onClick={() => handleFetchOAuth(activeCredential)}
            >
              {fetchingToken ? (
                <Loader2 className="h-3 w-3 motion-safe:animate-spin mr-1" />
              ) : null}
              {activeCredential.type === "oauth2rt"
                ? "Refresh token"
                : "Fetch token"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={clearCredential}
          >
            Clear
          </Button>
        </div>
      )}

      {showAdd ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2">{addForm}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 gap-1.5 text-xs"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add credential
        </Button>
      )}

      {credManageList}
    </div>
  );
}

export { credentialRequiresAuth };
