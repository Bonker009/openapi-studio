"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type CredentialType,
  credentialRequiresAuth,
  getActiveCredential,
  getActiveCredentialId,
  getCredentials,
  newCredentialId,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TokenPanelProps = {
  specId: string;
  activeCredential: Credential | null;
  onActiveChange: (credential: Credential | null) => void;
  variant?: "sidebar" | "navbar";
};

const CREDENTIAL_TYPES: { value: CredentialType; label: string }[] = [
  { value: "bearer", label: "Bearer" },
  { value: "basic", label: "Basic auth" },
  { value: "apiKey", label: "API key" },
  { value: "oauth2cc", label: "OAuth2 (client credentials)" },
  { value: "oauth2rt", label: "OAuth2 (refresh token)" },
];

function expirySource(credential: Credential | null): string | number | null {
  if (!credential) return null;
  if (
    (credential.type === "oauth2cc" || credential.type === "oauth2rt") &&
    credential.expiresAt
  ) {
    return credential.expiresAt;
  }
  if (credential.type === "bearer") return credential.token;
  return null;
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
  const [addType, setAddType] = useState<CredentialType>("bearer");
  const [newName, setNewName] = useState("");
  const [fetchingToken, setFetchingToken] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);

  const [bearerToken, setBearerToken] = useState("");
  const [basicUser, setBasicUser] = useState("");
  const [basicPass, setBasicPass] = useState("");
  const [apiKeyIn, setApiKeyIn] = useState<"header" | "query">("header");
  const [apiKeyName, setApiKeyName] = useState("X-API-Key");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [oauthUrl, setOauthUrl] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthSecret, setOauthSecret] = useState("");
  const [oauthScope, setOauthScope] = useState("");
  const [oauthRefreshToken, setOauthRefreshToken] = useState("");

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

  useEffect(() => {
    const saved = getCredentials(specId);
    setCredsState(saved);
    const active = getActiveCredential(specId);
    if (active) onActiveChange(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per spec
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

  const resetAddForm = () => {
    setNewName("");
    setBearerToken("");
    setBasicUser("");
    setBasicPass("");
    setApiKeyValue("");
    setOauthUrl("");
    setOauthClientId("");
    setOauthSecret("");
    setOauthScope("");
    setOauthRefreshToken("");
  };

  const buildNewCredential = (): Credential | null => {
    const name = newName.trim();
    if (!name) return null;
    const id = newCredentialId();

    if (addType === "bearer") {
      if (!bearerToken.trim()) return null;
      return { id, name, type: "bearer", token: bearerToken.trim() };
    }
    if (addType === "basic") {
      return {
        id,
        name,
        type: "basic",
        username: basicUser,
        password: basicPass,
      };
    }
    if (addType === "apiKey") {
      if (!apiKeyValue.trim() || !apiKeyName.trim()) return null;
      return {
        id,
        name,
        type: "apiKey",
        in: apiKeyIn,
        paramName: apiKeyName.trim(),
        value: apiKeyValue.trim(),
      };
    }
    if (addType === "oauth2cc") {
      if (!oauthUrl.trim() || !oauthClientId.trim() || !oauthSecret.trim()) {
        return null;
      }
      return {
        id,
        name,
        type: "oauth2cc",
        tokenUrl: oauthUrl.trim(),
        clientId: oauthClientId.trim(),
        clientSecret: oauthSecret.trim(),
        scope: oauthScope.trim() || undefined,
      };
    }
    if (addType === "oauth2rt") {
      if (
        !oauthUrl.trim() ||
        !oauthClientId.trim() ||
        !oauthSecret.trim() ||
        !oauthRefreshToken.trim()
      ) {
        return null;
      }
      return {
        id,
        name,
        type: "oauth2rt",
        tokenUrl: oauthUrl.trim(),
        clientId: oauthClientId.trim(),
        clientSecret: oauthSecret.trim(),
        scope: oauthScope.trim() || undefined,
        refreshToken: oauthRefreshToken.trim(),
      };
    }
    return null;
  };

  const addCredential = () => {
    const cred = buildNewCredential();
    if (!cred) {
      toast.error("Fill in all required fields");
      return;
    }
    const next = [...credentials, cred];
    persist(next);
    selectCredential(cred.id);
    resetAddForm();
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

  const addForm = (
    <div className="space-y-2">
      <Label htmlFor="cred-add-type" className="text-xs">
        Credential type
      </Label>
      <Select
        value={addType}
        onValueChange={(v) => setAddType(v as CredentialType)}
      >
        <SelectTrigger id="cred-add-type" className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CREDENTIAL_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="cred-add-name" className="text-xs">
        Name
      </Label>
      <Input
        id="cred-add-name"
        placeholder="e.g. Admin"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="h-8 text-sm"
      />
      {addType === "bearer" && (
        <>
          <Label htmlFor="cred-add-bearer" className="text-xs">
            Bearer token
          </Label>
          <Input
            id="cred-add-bearer"
            type="password"
            placeholder="Bearer token"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            className="h-8 text-sm font-mono"
          />
        </>
      )}
      {addType === "basic" && (
        <>
          <Label htmlFor="cred-add-basic-user" className="text-xs">
            Username
          </Label>
          <Input
            id="cred-add-basic-user"
            placeholder="Username"
            value={basicUser}
            onChange={(e) => setBasicUser(e.target.value)}
            className="h-8 text-sm"
          />
          <Label htmlFor="cred-add-basic-pass" className="text-xs">
            Password
          </Label>
          <Input
            id="cred-add-basic-pass"
            type="password"
            placeholder="Password"
            value={basicPass}
            onChange={(e) => setBasicPass(e.target.value)}
            className="h-8 text-sm"
          />
        </>
      )}
      {addType === "apiKey" && (
        <>
          <Label htmlFor="cred-add-apikey-in" className="text-xs">
            Send API key in
          </Label>
          <Select
            value={apiKeyIn}
            onValueChange={(v) => setApiKeyIn(v as "header" | "query")}
          >
            <SelectTrigger id="cred-add-apikey-in" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="query">Query</SelectItem>
            </SelectContent>
          </Select>
          <Label htmlFor="cred-add-apikey-name" className="text-xs">
            Parameter name
          </Label>
          <Input
            id="cred-add-apikey-name"
            placeholder="X-API-Key"
            value={apiKeyName}
            onChange={(e) => setApiKeyName(e.target.value)}
            className="h-8 text-sm font-mono"
          />
          <Label htmlFor="cred-add-apikey-value" className="text-xs">
            API key value
          </Label>
          <Input
            id="cred-add-apikey-value"
            type="password"
            placeholder="API key value"
            value={apiKeyValue}
            onChange={(e) => setApiKeyValue(e.target.value)}
            className="h-8 text-sm font-mono"
          />
        </>
      )}
      {(addType === "oauth2cc" || addType === "oauth2rt") && (
        <>
          <Label htmlFor="cred-add-oauth-url" className="text-xs">
            Token URL
          </Label>
          <Input
            id="cred-add-oauth-url"
            placeholder="https://auth.example.com/oauth/token"
            value={oauthUrl}
            onChange={(e) => setOauthUrl(e.target.value)}
            className="h-8 text-sm font-mono"
          />
          <Label htmlFor="cred-add-oauth-client-id" className="text-xs">
            Client ID
          </Label>
          <Input
            id="cred-add-oauth-client-id"
            placeholder="Client ID"
            value={oauthClientId}
            onChange={(e) => setOauthClientId(e.target.value)}
            className="h-8 text-sm"
          />
          <Label htmlFor="cred-add-oauth-secret" className="text-xs">
            Client secret
          </Label>
          <Input
            id="cred-add-oauth-secret"
            type="password"
            placeholder="Client secret"
            value={oauthSecret}
            onChange={(e) => setOauthSecret(e.target.value)}
            className="h-8 text-sm"
          />
          <Label htmlFor="cred-add-oauth-scope" className="text-xs">
            Scope (optional)
          </Label>
          <Input
            id="cred-add-oauth-scope"
            placeholder="read write"
            value={oauthScope}
            onChange={(e) => setOauthScope(e.target.value)}
            className="h-8 text-sm"
          />
          {addType === "oauth2rt" && (
            <>
              <Label htmlFor="cred-add-oauth-refresh" className="text-xs">
                Refresh token
              </Label>
              <Input
                id="cred-add-oauth-refresh"
                type="password"
                placeholder="Refresh token"
                value={oauthRefreshToken}
                onChange={(e) => setOauthRefreshToken(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </>
          )}
        </>
      )}
      <Button size="sm" className="w-full h-8" onClick={addCredential}>
        Save credential
      </Button>
    </div>
  );

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
          <PopoverContent className="w-80" align="end">
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
