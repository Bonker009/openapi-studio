function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function buildCurlCommand(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): string {
  const lines = [`curl -X ${method} ${shellQuote(url)}`];
  for (const [key, value] of Object.entries(headers)) {
    if (value) lines.push(`  -H ${shellQuote(`${key}: ${value}`)}`);
  }
  if (
    body?.trim() &&
    !["GET", "HEAD"].includes(method.toUpperCase())
  ) {
    lines.push(`  -d ${shellQuote(body)}`);
  }
  return lines.join(" \\\n");
}
