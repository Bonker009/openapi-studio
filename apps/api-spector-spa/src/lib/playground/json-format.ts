/** JSON formatting helpers for the playground. */

export function parseJsonValue(raw: string): unknown | null {
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

export function isJsonTreeValue(
  value: unknown
): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === "object";
}

export function formatJsonBody(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return null;
  }
}

export function formatResponseBodyForDisplay(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === "object") {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return null;
    }
  }
  const text = String(data).trim();
  if (!text) return null;
  return formatJsonBody(text) ?? text;
}

export function isJsonDisplayText(text: string): boolean {
  return formatJsonBody(text.trim()) !== null;
}

export function byteSizeLabel(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
