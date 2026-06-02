import type { EndpointAuthRole } from "@/lib/playground/endpoints";
import { endpointKey } from "@/shared/utils/endpoint-key";

const storageKey = (specId: string) => `playground_endpoint_auth_roles_${specId}`;

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

export function getEndpointAuthRoleOverrides(
  specId: string
): Record<string, EndpointAuthRole> {
  return safeGet<Record<string, EndpointAuthRole>>(storageKey(specId)) ?? {};
}

export function setEndpointAuthRoleOverride(
  specId: string,
  key: string,
  role: EndpointAuthRole | null
): Record<string, EndpointAuthRole> {
  const current = { ...getEndpointAuthRoleOverrides(specId) };
  if (role === null) {
    delete current[key];
  } else {
    current[key] = role;
  }
  safeSet(storageKey(specId), current);
  return current;
}

export function resolveEndpointAuthRole(
  requiresAuth: boolean,
  override?: EndpointAuthRole
): EndpointAuthRole {
  if (override) return override;
  return requiresAuth ? "protected" : "none";
}

export function withEndpointAuthRoles<
  T extends { method: string; path: string; requiresAuth: boolean },
>(
  endpoints: T[],
  overrides: Record<string, EndpointAuthRole>
): (T & { authRole: EndpointAuthRole })[] {
  return endpoints.map((ep) => {
    const key = endpointKey(ep.method, ep.path);
    const authRole = resolveEndpointAuthRole(
      ep.requiresAuth,
      overrides[key]
    );
    return { ...ep, authRole };
  });
}

export function playgroundAuthApplies(authRole?: EndpointAuthRole): boolean {
  return authRole === "protected";
}
