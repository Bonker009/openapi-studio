/** Canonical endpoint key: `METHOD:path` (uppercase method). */
export function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()}:${path}`;
}

/** Working-path key used in documentation status maps (lowercase method). */
export function toWorkingPathKey(method: string, path: string): string {
  return `${method.toLowerCase()}:${path}`;
}

export function buildWorkingPathSet(
  statusRows: Array<{ method: string; path: string; working?: boolean }>
): Set<string> {
  const set = new Set<string>();
  for (const row of statusRows) {
    if (row.working) {
      set.add(toWorkingPathKey(row.method, row.path));
    }
  }
  return set;
}
