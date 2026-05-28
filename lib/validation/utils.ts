export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Set a deep value on a cloned object given a dotted / bracket path. */
export function setDeepValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const clone = deepClone(obj);
  const keys = path.split(/\.|\[(\d+)\]/).filter(Boolean);

  let current: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = Number.isNaN(Number(keys[i])) ? keys[i] : Number(keys[i]);
    if (!(key in current) || current[key] == null) {
      current[key] = typeof keys[i + 1] === "string" && !Number.isNaN(Number(keys[i + 1]))
        ? []
        : {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = Number.isNaN(Number(keys[keys.length - 1]))
    ? keys[keys.length - 1]
    : Number(keys[keys.length - 1]);

  current[lastKey] = value as never;
  return clone;
}

export function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isDateField(key: string, value: string): boolean {
  const isoDateRegex =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
  return key.toLowerCase().includes("date") && isoDateRegex.test(value);
}

export function repeatChar(char: string, count: number): string {
  return char.repeat(Math.max(0, count));
}
