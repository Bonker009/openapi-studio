export {
  allowPrivateHostsByDefault,
  isHostnameAllowedByPolicy,
  isPrivateIp,
  parseAllowedHostnamesFromEnv,
  type HostPolicyOptions,
} from "@/lib/security/ssrf-policy";

export function isSafeOutboundUrlSync(
  url: string,
  options: import("@/lib/security/ssrf-policy").HostPolicyOptions = {}
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.username || parsed.password) return false;
    const { isHostnameAllowedByPolicy, allowPrivateHostsByDefault } =
      require("@/lib/security/ssrf-policy") as typeof import("@/lib/security/ssrf-policy");
    return isHostnameAllowedByPolicy(parsed.hostname, {
      ...options,
      allowPrivateHosts:
        options.allowPrivateHosts ?? allowPrivateHostsByDefault(),
    });
  } catch {
    return false;
  }
}
