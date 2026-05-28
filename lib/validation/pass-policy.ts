import type { PassPolicy } from "@/lib/validation/types";

export function statusMatchesPassPolicy(
  status: number,
  policy: PassPolicy
): boolean {
  if (status === 0) return false;
  switch (policy.kind) {
    case "strict-400":
      return status === 400;
    case "4xx-or-422":
      return status === 422 || (status >= 400 && status < 500);
    case "custom-range":
      return status >= policy.min && status <= policy.max;
    case "4xx":
    default:
      return status >= 400 && status < 500;
  }
}

export function classifyOutcome(
  status: number,
  hasTransportError: boolean,
  policy: PassPolicy
): "pass" | "fail" | "error" {
  if (hasTransportError || status === 0) return "error";
  if (status >= 500) return "error";
  if (statusMatchesPassPolicy(status, policy)) return "pass";
  return "fail";
}
