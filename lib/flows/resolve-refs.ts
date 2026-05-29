/**
 * Token + JSON-path resolution for flow steps. Framework-agnostic (no React/Next).
 *
 * Supported {{...}} token grammar:
 *   {{vars.NAME}}                 -> a captured variable
 *   {{steps.<index>.status}}      -> a prior step HTTP status
 *   {{steps.<index>.body.<path>}} -> a value in a prior step response body
 *   {{steps.<index>.headers.<name>}} -> a prior step response header
 */

export type StepResponse = {
  status: number;
  statusText?: string;
  headers: Record<string, string>;
  body: unknown;
};

export type RunContext = {
  /** Captured variables by name. */
  vars: Record<string, unknown>;
  /** Completed step responses, indexed by step position. */
  steps: (StepResponse | undefined)[];
};

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Traverse an object with a dot/bracket path like "data[0].id". */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const segments = pathToSegments(path);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** "data[0].id" -> ["data", "0", "id"] */
export function pathToSegments(path: string): string[] {
  return path
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type TokenRef =
  | { kind: "var"; name: string; raw: string }
  | { kind: "stepStatus"; stepIndex: number; raw: string }
  | { kind: "stepBody"; stepIndex: number; path: string; raw: string }
  | { kind: "stepHeader"; stepIndex: number; header: string; raw: string }
  | { kind: "unknown"; raw: string };

/** Parse the inside of a {{...}} token. */
export function parseTokenExpression(expr: string, raw: string): TokenRef {
  const trimmed = expr.trim();

  if (trimmed.startsWith("vars.")) {
    return { kind: "var", name: trimmed.slice("vars.".length), raw };
  }

  if (trimmed.startsWith("steps.")) {
    const rest = trimmed.slice("steps.".length);
    const dot = rest.indexOf(".");
    if (dot === -1) return { kind: "unknown", raw };
    const idxStr = rest.slice(0, dot);
    const after = rest.slice(dot + 1);
    const stepIndex = Number(idxStr);
    if (!Number.isInteger(stepIndex) || stepIndex < 0) {
      return { kind: "unknown", raw };
    }
    if (after === "status") {
      return { kind: "stepStatus", stepIndex, raw };
    }
    if (after.startsWith("body")) {
      const path = after === "body" ? "" : after.slice("body.".length);
      return { kind: "stepBody", stepIndex, path, raw };
    }
    if (after.startsWith("headers.")) {
      return {
        kind: "stepHeader",
        stepIndex,
        header: after.slice("headers.".length),
        raw,
      };
    }
  }

  return { kind: "unknown", raw };
}

/** Extract all token references found in a string. */
export function extractTokenRefs(text: string): TokenRef[] {
  if (!text) return [];
  const refs: TokenRef[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    refs.push(parseTokenExpression(match[1], match[0]));
  }
  return refs;
}

function stringifyValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Resolve a single token ref against the run context. */
function resolveRef(
  ref: TokenRef,
  ctx: RunContext
): { value: string; ok: boolean } {
  switch (ref.kind) {
    case "var": {
      if (!(ref.name in ctx.vars)) return { value: "", ok: false };
      const v = ctx.vars[ref.name];
      if (v === undefined) return { value: "", ok: false };
      return { value: stringifyValue(v), ok: true };
    }
    case "stepStatus": {
      const step = ctx.steps[ref.stepIndex];
      if (!step) return { value: "", ok: false };
      return { value: String(step.status), ok: true };
    }
    case "stepBody": {
      const step = ctx.steps[ref.stepIndex];
      if (!step) return { value: "", ok: false };
      const v = getByPath(step.body, ref.path);
      if (v === undefined) return { value: "", ok: false };
      return { value: stringifyValue(v), ok: true };
    }
    case "stepHeader": {
      const step = ctx.steps[ref.stepIndex];
      if (!step) return { value: "", ok: false };
      const key = Object.keys(step.headers).find(
        (k) => k.toLowerCase() === ref.header.toLowerCase()
      );
      if (!key) return { value: "", ok: false };
      return { value: step.headers[key], ok: true };
    }
    default:
      return { value: "", ok: false };
  }
}

export type ResolveResult = {
  value: string;
  /** Raw tokens that could not be resolved. */
  missing: string[];
};

/** Replace every {{...}} token in a string. Records unresolved tokens. */
export function resolveString(text: string, ctx: RunContext): ResolveResult {
  if (!text) return { value: text, missing: [] };
  const missing: string[] = [];
  const value = text.replace(TOKEN_RE, (raw, expr) => {
    const ref = parseTokenExpression(expr, raw);
    const resolved = resolveRef(ref, ctx);
    if (!resolved.ok) {
      missing.push(raw);
      return raw;
    }
    return resolved.value;
  });
  return { value, missing };
}

/** Resolve every value in a record, collecting all missing tokens. */
export function resolveRecord(
  record: Record<string, string>,
  ctx: RunContext
): { values: Record<string, string>; missing: string[] } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const [k, v] of Object.entries(record)) {
    const res = resolveString(v, ctx);
    values[k] = res.value;
    missing.push(...res.missing);
  }
  return { values, missing };
}
