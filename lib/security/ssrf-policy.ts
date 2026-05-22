const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
]);

const BLOCKED_HOST_SUFFIXES = [".internal", ".local", ".localhost"];

export function allowPrivateHostsByDefault(): boolean {
  if (process.env.PLAYGROUND_ALLOW_PRIVATE_HOSTS === "true") return true;
  if (process.env.PLAYGROUND_ALLOW_PRIVATE_HOSTS === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function parseAllowedHostnamesFromEnv(): string[] {
  const raw = process.env.PLAYGROUND_ALLOWED_HOSTS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function isIpv4Literal(host: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function isIpv6Literal(host: string): boolean {
  return host.includes(":");
}

export function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe80:")) return true;
  return false;
}

export function isPrivateIp(host: string): boolean {
  if (isIpv4Literal(host)) return isPrivateIpv4(host);
  if (isIpv6Literal(host)) return isPrivateIpv6(host);
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower === "169.254.169.254") return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export type HostPolicyOptions = {
  allowPrivateHosts?: boolean;
  extraAllowedHostnames?: string[];
};

export function isHostnameAllowedByPolicy(
  hostname: string,
  opts: HostPolicyOptions = {}
): boolean {
  const lower = hostname.toLowerCase();
  const extras = [
    ...(opts.extraAllowedHostnames ?? []),
    ...parseAllowedHostnamesFromEnv(),
  ];
  if (extras.includes(lower)) return true;

  const allowPrivate =
    opts.allowPrivateHosts ?? allowPrivateHostsByDefault();

  if (allowPrivate) {
    if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") {
      return true;
    }
    if (isIpv4Literal(lower) || isIpv6Literal(lower)) {
      if (isPrivateIp(lower)) return true;
    }
  }

  if (isBlockedHostname(lower)) return false;
  if (!allowPrivate && (lower === "localhost" || lower === "::1")) {
    return false;
  }
  return true;
}
