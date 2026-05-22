import "server-only";

import dns from "node:dns/promises";
import {
  allowPrivateHostsByDefault,
  isHostnameAllowedByPolicy,
  isPrivateIp,
  type HostPolicyOptions,
} from "@/lib/security/ssrf-policy";

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

export type SsrfOptions = HostPolicyOptions;

function isIpLiteral(hostname: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
}

async function assertResolvedIpsSafe(
  hostname: string,
  opts: HostPolicyOptions
): Promise<void> {
  if (isIpLiteral(hostname)) {
    if (isPrivateIp(hostname) && !opts.allowPrivateHosts) {
      throw new SsrfError("Requests to private IP addresses are not allowed");
    }
    if (hostname === "169.254.169.254") {
      throw new SsrfError("Requests to cloud metadata endpoints are not allowed");
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfError(`Could not resolve hostname: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new SsrfError(`Could not resolve hostname: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (address === "169.254.169.254") {
      throw new SsrfError("Requests to cloud metadata endpoints are not allowed");
    }
    if (isPrivateIp(address) && !opts.allowPrivateHosts) {
      throw new SsrfError(
        `Hostname ${hostname} resolves to a private address (${address})`
      );
    }
  }
}

export async function assertSafeOutboundUrl(
  url: string,
  options: SsrfOptions = {}
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfError("Only http and https URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new SsrfError("URLs with credentials are not allowed");
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new SsrfError("Missing hostname");
  }

  const allowPrivate =
    options.allowPrivateHosts ?? allowPrivateHostsByDefault();

  if (
    !isHostnameAllowedByPolicy(hostname, {
      ...options,
      allowPrivateHosts: allowPrivate,
    })
  ) {
    throw new SsrfError(`Hostname is not allowed: ${hostname}`);
  }

  await assertResolvedIpsSafe(hostname, {
    ...options,
    allowPrivateHosts: allowPrivate,
  });

  return parsed;
}
