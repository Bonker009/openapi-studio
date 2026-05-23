/** Count JSON tree nodes; stops once `limit` is exceeded. */
export function countJsonNodes(value: unknown, limit = 201): number {
  let count = 0;

  function walk(v: unknown): boolean {
    if (count > limit) return false;
    count++;
    if (v === null || typeof v !== "object") return true;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (!walk(item)) return false;
      }
      return true;
    }
    for (const key of Object.keys(v as Record<string, unknown>)) {
      if (!walk((v as Record<string, unknown>)[key])) return false;
    }
    return true;
  }

  walk(value);
  return count;
}

export const JSON_TREE_AUTO_EXPAND_NODE_LIMIT = 200;
