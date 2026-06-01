/** Built-in {{random.*}} and {{timestamp}} helpers (no I/O). */

export function resolveBuiltinFunction(expr: string): string | null {
  const key = expr.trim().toLowerCase();
  switch (key) {
    case "random.uuid":
      return crypto.randomUUID();
    case "random.int":
      return String(Math.floor(Math.random() * 1_000_000));
    case "timestamp":
      return String(Date.now());
    case "timestamp.iso":
      return new Date().toISOString();
    default:
      return null;
  }
}
