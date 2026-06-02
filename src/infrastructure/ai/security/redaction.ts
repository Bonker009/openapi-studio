const SENSITIVE_KEY =
  /(password|secret|token|api[_-]?key|authorization|client[_-]?secret|refresh[_-]?token|access[_-]?token|credential)/i;

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (!SENSITIVE_KEY.test(key)) return value;
  if (typeof value === "string") return "[REDACTED]";
  if (value && typeof value === "object") return "[REDACTED_OBJECT]";
  return "[REDACTED]";
}

export function redactObjectDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactObjectDeep(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactSensitiveValue(k, redactObjectDeep(v));
    }
    return out;
  }
  return value;
}

export function redactText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(
      /"(password|client_secret|api_key|token|refresh_token|access_token)"\s*:\s*"[^"]*"/gi,
      '"$1":"[REDACTED]"'
    );
}
