/**
 * Token + JSON-path resolution for flow steps. Framework-agnostic (no React/Next).
 *
 * Supported {{...}} tokens:
 *   {{vars.NAME}}                    captured variable
 *   {{global.NAME}}                  flow/global scope
 *   {{env.NAME}}                     environment variable
 *   {{baseUrl}}                      env.baseUrl shorthand
 *   {{steps.<index>.status|body|headers}}
 *   {{step.<stepName>.body.<path>}}  named step reference
 *   {{random.uuid}}, {{random.int}}, {{timestamp}}, {{timestamp.iso}}
 */

import type { RunContext, StepResponse } from "@/domain/flows/types";
import { resolveBuiltinFunction } from "./builtin-functions";

export type { RunContext, StepResponse };

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

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

export function pathToSegments(path: string): string[] {
  return path
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type TokenRef =
  | { kind: "var"; name: string; raw: string }
  | { kind: "global"; name: string; raw: string }
  | { kind: "env"; name: string; raw: string }
  | { kind: "baseUrl"; raw: string }
  | { kind: "builtin"; expr: string; raw: string }
  | { kind: "stepStatus"; stepIndex: number; raw: string }
  | { kind: "stepBody"; stepIndex: number; path: string; raw: string }
  | { kind: "stepHeader"; stepIndex: number; header: string; raw: string }
  | { kind: "namedStepBody"; stepName: string; path: string; raw: string }
  | { kind: "namedStepStatus"; stepName: string; raw: string }
  | { kind: "unknown"; raw: string };

export function parseTokenExpression(expr: string, raw: string): TokenRef {
  const trimmed = expr.trim();

  const builtin = resolveBuiltinFunction(trimmed);
  if (builtin !== null || trimmed.startsWith("random.") || trimmed.startsWith("timestamp")) {
    return { kind: "builtin", expr: trimmed, raw };
  }

  if (trimmed === "baseUrl") {
    return { kind: "baseUrl", raw };
  }

  if (trimmed.startsWith("vars.")) {
    return { kind: "var", name: trimmed.slice("vars.".length), raw };
  }

  if (trimmed.startsWith("global.")) {
    return { kind: "global", name: trimmed.slice("global.".length), raw };
  }

  if (trimmed.startsWith("env.")) {
    return { kind: "env", name: trimmed.slice("env.".length), raw };
  }

  if (trimmed.startsWith("step.")) {
    const rest = trimmed.slice("step.".length);
    const dot = rest.indexOf(".");
    if (dot === -1) return { kind: "unknown", raw };
    const stepName = rest.slice(0, dot);
    const after = rest.slice(dot + 1);
    if (after === "status") {
      return { kind: "namedStepStatus", stepName, raw };
    }
    if (after.startsWith("body")) {
      const path = after === "body" ? "" : after.slice("body.".length);
      return { kind: "namedStepBody", stepName, path, raw };
    }
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

function resolveRef(
  ref: TokenRef,
  ctx: RunContext
): { value: string; ok: boolean } {
  switch (ref.kind) {
    case "builtin": {
      const v = resolveBuiltinFunction(ref.expr);
      return v !== null ? { value: v, ok: true } : { value: "", ok: false };
    }
    case "baseUrl": {
      const v = ctx.env?.baseUrl ?? ctx.vars.baseUrl;
      if (v === undefined) return { value: "", ok: false };
      return { value: stringifyValue(v), ok: true };
    }
    case "var": {
      if (!(ref.name in ctx.vars)) return { value: "", ok: false };
      const v = ctx.vars[ref.name];
      if (v === undefined) return { value: "", ok: false };
      return { value: stringifyValue(v), ok: true };
    }
    case "global": {
      const global = ctx.global ?? {};
      if (!(ref.name in global)) return { value: "", ok: false };
      return { value: stringifyValue(global[ref.name]), ok: true };
    }
    case "env": {
      const env = ctx.env ?? {};
      if (!(ref.name in env)) return { value: "", ok: false };
      return { value: stringifyValue(env[ref.name]), ok: true };
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
    case "namedStepStatus": {
      const idx = ctx.stepIndexByName?.[ref.stepName];
      if (idx === undefined) return { value: "", ok: false };
      const step = ctx.steps[idx];
      if (!step) return { value: "", ok: false };
      return { value: String(step.status), ok: true };
    }
    case "namedStepBody": {
      const idx = ctx.stepIndexByName?.[ref.stepName];
      if (idx === undefined) return { value: "", ok: false };
      const step = ctx.steps[idx];
      if (!step) return { value: "", ok: false };
      const v = getByPath(step.body, ref.path);
      if (v === undefined) return { value: "", ok: false };
      return { value: stringifyValue(v), ok: true };
    }
    default:
      return { value: "", ok: false };
  }
}

export type ResolveResult = {
  value: string;
  missing: string[];
};

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

/** Apply environment + flow variables into a fresh run context. */
export function seedRunContext(options: {
  environment?: Record<string, unknown>;
  flowVariables?: Record<string, string>;
  global?: Record<string, unknown>;
  seed?: RunContext;
}): RunContext {
  const base = options.seed
    ? structuredClone(options.seed)
    : {
        vars: {},
        global: {},
        env: {},
        steps: [],
        stepIndexByName: {},
      };
  base.env = { ...base.env, ...(options.environment ?? {}) };
  base.vars = { ...base.vars, ...(options.flowVariables ?? {}) };
  base.global = { ...base.global, ...(options.global ?? {}) };
  if (options.environment?.baseUrl != null) {
    base.env.baseUrl = options.environment.baseUrl;
  }
  return base;
}

export function registerStepNames(
  ctx: RunContext,
  steps: Array<{ id: string; name?: string }>
): void {
  ctx.stepIndexByName = {};
  steps.forEach((step, index) => {
    const name = step.name?.trim();
    if (name) ctx.stepIndexByName[name] = index;
    ctx.stepIndexByName[step.id] = index;
  });
}
