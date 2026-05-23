import type { MultipartFieldRow } from "@/lib/playground/build-form-data";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export type CurlBodyInput =
  | { type: "json"; text: string }
  | { type: "multipart"; rows: MultipartFieldRow[] }
  | { type: "binary"; file: File | null };

export function buildCurlCommand(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string | CurlBodyInput
): string {
  const lines = [`curl -X ${method} ${shellQuote(url)}`];
  for (const [key, value] of Object.entries(headers)) {
    if (value) lines.push(`  -H ${shellQuote(`${key}: ${value}`)}`);
  }

  if (["GET", "HEAD"].includes(method.toUpperCase())) {
    return lines.join(" \\\n");
  }

  if (typeof body === "string") {
    if (body.trim()) {
      lines.push(`  -d ${shellQuote(body)}`);
    }
    return lines.join(" \\\n");
  }

  if (!body) return lines.join(" \\\n");

  if (body.type === "json" && body.text.trim()) {
    lines.push(`  -d ${shellQuote(body.text)}`);
  } else if (body.type === "multipart") {
    for (const row of body.rows) {
      const key = row.key.trim();
      if (!key) continue;
      if (row.type === "file" && row.file) {
        lines.push(`  -F ${shellQuote(`${key}=@${row.file.name}`)}`);
      } else if (row.type === "text" && row.textValue) {
        lines.push(`  -F ${shellQuote(`${key}=${row.textValue}`)}`);
      } else if (row.type === "file") {
        lines.push(`  -F ${shellQuote(`${key}=@filename`)}`);
      }
    }
  } else if (body.type === "binary" && body.file) {
    lines.push(`  --data-binary ${shellQuote(`@${body.file.name}`)}`);
  } else if (body.type === "binary") {
    lines.push(`  --data-binary ${shellQuote("@filename")}`);
  }

  return lines.join(" \\\n");
}
