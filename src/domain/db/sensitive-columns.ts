const SENSITIVE_NAME_RE =
  /password|passwd|secret|token|api_key|apikey|credential|ssn|credit_card|card_number|private_key/i;

export function isSensitiveColumn(name: string): boolean {
  return SENSITIVE_NAME_RE.test(name);
}

export function maskCellValue(columnName: string, value: unknown): string {
  if (value == null) return "null";
  const str = String(value);
  if (isSensitiveColumn(columnName)) {
    if (str.length <= 4) return "****";
    return `${str.slice(0, 2)}****${str.slice(-2)}`;
  }
  return str;
}
