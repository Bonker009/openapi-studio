import { allowPrivateHostsByDefault } from "@/lib/security/ssrf-policy";

function parseExtraHosts(): Set<string> {
  const raw = process.env.PLAYGROUND_ALLOWED_HOSTS?.trim();
  const set = new Set<string>();
  if (!raw) return set;
  for (const h of raw.split(",")) {
    const t = h.trim().toLowerCase();
    if (t) set.add(t);
  }
  return set;
}

export function getAllowedPlaygroundHostnames(baseUrl: string): Set<string> {
  const allowed = new Set<string>(parseExtraHosts());
  try {
    allowed.add(new URL(baseUrl).hostname.toLowerCase());
  } catch {
    /* ignore invalid base */
  }
  if (allowPrivateHostsByDefault()) {
    allowed.add("localhost");
    allowed.add("127.0.0.1");
    allowed.add("::1");
  }
  return allowed;
}

export function assertPlaygroundRequestUrl(
  url: string,
  baseUrl: string
): { ok: true } | { ok: false; error: string } {
  let target: URL;
  let base: URL;
  try {
    target = new URL(url);
    base = new URL(baseUrl);
  } catch {
    return { ok: false, error: "Invalid request URL" };
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are allowed" };
  }

  const allowed = getAllowedPlaygroundHostnames(baseUrl);
  const host = target.hostname.toLowerCase();
  if (!allowed.has(host)) {
    return {
      ok: false,
      error: `Host "${host}" is not allowed. Use the environment server (${base.hostname}) or add PLAYGROUND_ALLOWED_HOSTS.`,
    };
  }

  return { ok: true };
}
