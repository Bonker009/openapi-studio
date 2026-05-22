export type JwtPayload = {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
};

/** Decode JWT payload without verifying signature. */
export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Seconds until JWT expiry, or null if not a JWT / no exp claim. */
export function secondsUntilExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now;
}

/** Human-readable expiry label for UI badges. */
export function formatExpiryLabel(token: string): string | null {
  const secs = secondsUntilExpiry(token);
  if (secs === null) return null;
  if (secs <= 0) return "Expired";
  if (secs < 60) return `Expires in ${secs}s`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `Expires in ${m}m ${s}s` : `Expires in ${m}m`;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `Expires in ${h}h ${m}m` : `Expires in ${h}h`;
}

export function isExpiringSoon(token: string, withinSeconds = 300): boolean {
  const secs = secondsUntilExpiry(token);
  return secs !== null && secs > 0 && secs <= withinSeconds;
}
