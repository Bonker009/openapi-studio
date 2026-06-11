"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  newCredentialId,
} from "@/lib/playground/credentials";
import { toast } from "sonner";

const CREDENTIAL_TYPES: { value: CredentialType; label: string }[] = [
  { value: "bearer", label: "Bearer" },
  { value: "basic", label: "Basic auth" },
  { value: "apiKey", label: "API key" },
  { value: "oauth2cc", label: "OAuth2 (client credentials)" },
  { value: "oauth2rt", label: "OAuth2 (refresh token)" },
];

export type CredentialAddFormPrefill = {
  type?: CredentialType;
  name?: string;
  bearerToken?: string;
  basicUser?: string;
  basicPass?: string;
  apiKeyIn?: "header" | "query";
  apiKeyName?: string;
  apiKeyValue?: string;
  oauthUrl?: string;
  oauthClientId?: string;
  oauthSecret?: string;
  oauthScope?: string;
  oauthRefreshToken?: string;
};

type CredentialAddFormProps = {
  prefill?: CredentialAddFormPrefill;
  submitLabel?: string;
  onSubmit: (credential: Credential) => void;
};

export function CredentialAddForm({
  prefill,
  submitLabel = "Save credential",
  onSubmit,
}: CredentialAddFormProps) {
  const [addType, setAddType] = useState<CredentialType>(
    prefill?.type ?? "bearer"
  );
  const [newName, setNewName] = useState(prefill?.name ?? "");
  const [bearerToken, setBearerToken] = useState(prefill?.bearerToken ?? "");
  const [basicUser, setBasicUser] = useState(prefill?.basicUser ?? "");
  const [basicPass, setBasicPass] = useState(prefill?.basicPass ?? "");
  const [apiKeyIn, setApiKeyIn] = useState<"header" | "query">(
    prefill?.apiKeyIn ?? "header"
  );
  const [apiKeyName, setApiKeyName] = useState(prefill?.apiKeyName ?? "X-API-Key");
  const [apiKeyValue, setApiKeyValue] = useState(prefill?.apiKeyValue ?? "");
  const [oauthUrl, setOauthUrl] = useState(prefill?.oauthUrl ?? "");
  const [oauthClientId, setOauthClientId] = useState(prefill?.oauthClientId ?? "");
  const [oauthSecret, setOauthSecret] = useState(prefill?.oauthSecret ?? "");
  const [oauthScope, setOauthScope] = useState(prefill?.oauthScope ?? "");
  const [oauthRefreshToken, setOauthRefreshToken] = useState(
    prefill?.oauthRefreshToken ?? ""
  );

  useEffect(() => {
    setAddType(prefill?.type ?? "bearer");
    setNewName(prefill?.name ?? "");
    setBearerToken(prefill?.bearerToken ?? "");
    setBasicUser(prefill?.basicUser ?? "");
    setBasicPass(prefill?.basicPass ?? "");
    setApiKeyIn(prefill?.apiKeyIn ?? "header");
    setApiKeyName(prefill?.apiKeyName ?? "X-API-Key");
    setApiKeyValue(prefill?.apiKeyValue ?? "");
    setOauthUrl(prefill?.oauthUrl ?? "");
    setOauthClientId(prefill?.oauthClientId ?? "");
    setOauthSecret(prefill?.oauthSecret ?? "");
    setOauthScope(prefill?.oauthScope ?? "");
    setOauthRefreshToken(prefill?.oauthRefreshToken ?? "");
  }, [prefill]);

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

  const handleSubmit = () => {
    const cred = buildNewCredential();
    if (!cred) {
      toast.error("Fill in all required fields");
      return;
    }
    onSubmit(cred);
  };

  return (
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
      <Button size="sm" className="w-full h-8" onClick={handleSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
