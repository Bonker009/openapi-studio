import {
  getCredentials,
  setCredentials,
  type Credential,
} from "@/lib/playground/credentials";
import { isExpiringSoon } from "@/lib/playground/token-utils";

export const TOKEN_REFRESH_LEAD_SECONDS = 300;

export type OAuthTokenResponse = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
};

export type EnsureFreshCredentialResult = {
  credential: Credential | null;
  refreshed: boolean;
};

function oauthExpirySubject(
  credential: Credential
): string | number | null {
  if (credential.type === "oauth2cc" || credential.type === "oauth2rt") {
    return credential.expiresAt ?? null;
  }
  if (credential.type === "bearer") {
    return credential.token;
  }
  return null;
}

export function credentialNeedsRefresh(
  credential: Credential | null,
  withinSeconds = TOKEN_REFRESH_LEAD_SECONDS
): boolean {
  if (!credential) return false;
  const subject = oauthExpirySubject(credential);
  if (subject === null) return false;
  return isExpiringSoon(subject, withinSeconds);
}

export async function fetchOAuthClientCredentials(
  credential: Extract<Credential, { type: "oauth2cc" }>
): Promise<OAuthTokenResponse> {
  const res = await fetch("/api/playground/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "client_credentials",
      tokenUrl: credential.tokenUrl,
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      scope: credential.scope,
    }),
  });
  const data = (await res.json()) as OAuthTokenResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to fetch token");
  }
  return data;
}

export async function fetchOAuthRefreshToken(
  credential: Extract<Credential, { type: "oauth2rt" }>
): Promise<OAuthTokenResponse> {
  const res = await fetch("/api/playground/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "refresh_token",
      tokenUrl: credential.tokenUrl,
      clientId: credential.clientId,
      clientSecret: credential.clientSecret,
      scope: credential.scope,
      refreshToken: credential.refreshToken,
    }),
  });
  const data = (await res.json()) as OAuthTokenResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to refresh token");
  }
  return data;
}

function persistCredentialUpdate(
  specId: string,
  credentialId: string,
  updater: (c: Credential) => Credential
): Credential | null {
  const list = getCredentials(specId);
  const idx = list.findIndex((c) => c.id === credentialId);
  if (idx < 0) return null;
  const next = [...list];
  next[idx] = updater(next[idx]);
  setCredentials(specId, next);
  return next[idx];
}

export async function refreshCredential(
  specId: string,
  credential: Credential
): Promise<Credential> {
  if (credential.type === "oauth2cc") {
    const data = await fetchOAuthClientCredentials(credential);
    const updated =
      persistCredentialUpdate(specId, credential.id, (c) => {
        if (c.type !== "oauth2cc") return c;
        return {
          ...c,
          accessToken: data.accessToken,
          expiresAt: data.expiresAt,
        };
      }) ?? {
        ...credential,
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
      };
    return updated;
  }

  if (credential.type === "oauth2rt") {
    const data = await fetchOAuthRefreshToken(credential);
    const updated =
      persistCredentialUpdate(specId, credential.id, (c) => {
        if (c.type !== "oauth2rt") return c;
        return {
          ...c,
          accessToken: data.accessToken,
          expiresAt: data.expiresAt,
          refreshToken: data.refreshToken ?? c.refreshToken,
        };
      }) ?? {
        ...credential,
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
        refreshToken: data.refreshToken ?? credential.refreshToken,
      };
    return updated;
  }

  return credential;
}

export async function ensureFreshCredential(
  specId: string,
  credential: Credential | null,
  withinSeconds = TOKEN_REFRESH_LEAD_SECONDS
): Promise<EnsureFreshCredentialResult> {
  if (!credential || typeof window === "undefined") {
    return { credential, refreshed: false };
  }

  if (!credentialNeedsRefresh(credential, withinSeconds)) {
    return { credential, refreshed: false };
  }

  if (credential.type !== "oauth2cc" && credential.type !== "oauth2rt") {
    return { credential, refreshed: false };
  }

  try {
    const updated = await refreshCredential(specId, credential);
    return { credential: updated, refreshed: true };
  } catch {
    return { credential, refreshed: false };
  }
}
