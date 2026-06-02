export type Credential =
  | { id: string; name: string; type: "bearer"; token: string }
  | {
      id: string;
      name: string;
      type: "basic";
      username: string;
      password: string;
    }
  | {
      id: string;
      name: string;
      type: "apiKey";
      in: "header" | "query";
      paramName: string;
      value: string;
    }
  | {
      id: string;
      name: string;
      type: "oauth2cc";
      tokenUrl: string;
      clientId: string;
      clientSecret: string;
      scope?: string;
      accessToken?: string;
      expiresAt?: number;
    }
  | {
      id: string;
      name: string;
      type: "oauth2rt";
      tokenUrl: string;
      clientId: string;
      clientSecret: string;
      scope?: string;
      refreshToken: string;
      accessToken?: string;
      expiresAt?: number;
    };

export type CredentialType = Credential["type"];

const credsKey = (specId: string) => `playground_credentials_${specId}`;
const activeKey = (specId: string) => `playground_active_credential_${specId}`;
const legacyTokensKey = (specId: string) => `playground_tokens_${specId}`;
const legacyActiveKey = (specId: string) => `playground_active_token_${specId}`;

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function migrateLegacyTokens(specId: string): Credential[] | null {
  const legacy = safeGet<Record<string, string>>(legacyTokensKey(specId));
  if (!legacy || Object.keys(legacy).length === 0) return null;

  const creds: Credential[] = Object.entries(legacy).map(([name, token], i) => ({
    id: `legacy-bearer-${i}-${name}`,
    name,
    type: "bearer" as const,
    token,
  }));

  safeSet(credsKey(specId), creds);
  const legacyActive = localStorage.getItem(legacyActiveKey(specId));
  if (legacyActive && creds.some((c) => c.name === legacyActive)) {
    const match = creds.find((c) => c.name === legacyActive);
    if (match) safeSet(activeKey(specId), match.id);
  }
  return creds;
}

export function getCredentials(specId: string): Credential[] {
  const stored = safeGet<Credential[]>(credsKey(specId));
  if (stored && Array.isArray(stored)) return stored;
  return migrateLegacyTokens(specId) ?? [];
}

export function setCredentials(specId: string, creds: Credential[]): void {
  safeSet(credsKey(specId), creds);
}

export function getActiveCredentialId(specId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(activeKey(specId));
}

export function setActiveCredentialId(specId: string, id: string | null): void {
  if (typeof window === "undefined") return;
  if (id === null) {
    localStorage.removeItem(activeKey(specId));
  } else {
    localStorage.setItem(activeKey(specId), id);
  }
}

export function getActiveCredential(specId: string): Credential | null {
  const creds = getCredentials(specId);
  const id = getActiveCredentialId(specId);
  if (!id) return null;
  return creds.find((c) => c.id === id) ?? null;
}

export function credentialRequiresAuth(credential: Credential | null): boolean {
  if (!credential) return false;
  if (credential.type === "oauth2cc" || credential.type === "oauth2rt") {
    return Boolean(credential.accessToken?.trim());
  }
  if (credential.type === "bearer") return Boolean(credential.token?.trim());
  if (credential.type === "basic") {
    return Boolean(credential.username?.trim() && credential.password);
  }
  if (credential.type === "apiKey") return Boolean(credential.value?.trim());
  return false;
}

export function newCredentialId(): string {
  return `cred-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
