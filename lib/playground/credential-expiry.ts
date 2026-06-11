import {
  getActiveCredentialId,
  getCredentials,
  setActiveCredentialId,
  setCredentials,
  type Credential,
} from "@/lib/playground/credentials";
import { isExpired } from "@/lib/playground/token-utils";

export function getCredentialExpirySubject(
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

export function isCredentialExpired(credential: Credential): boolean {
  const subject = getCredentialExpirySubject(credential);
  if (subject === null) return false;
  return isExpired(subject);
}

export type RemoveExpiredCredentialsResult = {
  removed: Credential[];
  remaining: Credential[];
  activeCredentialId: string | null;
};

export function removeExpiredCredentials(
  specId: string
): RemoveExpiredCredentialsResult {
  const all = getCredentials(specId);
  const removed: Credential[] = [];
  const remaining: Credential[] = [];

  for (const cred of all) {
    if (isCredentialExpired(cred)) {
      removed.push(cred);
    } else {
      remaining.push(cred);
    }
  }

  if (removed.length === 0) {
    return {
      removed,
      remaining: all,
      activeCredentialId: getActiveCredentialId(specId),
    };
  }

  setCredentials(specId, remaining);

  const activeId = getActiveCredentialId(specId);
  let activeCredentialId = activeId;
  if (activeId && removed.some((c) => c.id === activeId)) {
    setActiveCredentialId(specId, null);
    activeCredentialId = null;
  }

  return { removed, remaining, activeCredentialId };
}
