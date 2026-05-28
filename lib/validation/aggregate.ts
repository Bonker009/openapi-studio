import type { ValidationResult } from "@/lib/validation/types";
import { endpointKey } from "@/lib/validation/types";

export type ValidationAggregate = {
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  total: number;
  avgLatencyMs: number;
  slowest?: ValidationResult;
};

export function validationAggregate(
  results: ValidationResult[]
): ValidationAggregate {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter(
    (r) => !r.ok && r.outcome === "fail"
  ).length;
  const errors = results.filter(
    (r) => !r.ok && r.outcome === "error"
  ).length;
  const skipped = results.filter((r) => r.outcome === "skipped").length;
  const latencies = results.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs);
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
  const slowest =
    latencies.length > 0
      ? results.reduce((a, b) => (a.latencyMs >= b.latencyMs ? a : b))
      : undefined;

  return {
    passed,
    failed,
    errors,
    skipped,
    total: results.length,
    avgLatencyMs,
    slowest,
  };
}

export type EndpointGroup = {
  endpointKey: string;
  path: string;
  method: string;
  controller: string;
  results: ValidationResult[];
  aggregate: ValidationAggregate;
};

export function groupResultsByEndpoint(
  results: ValidationResult[]
): EndpointGroup[] {
  const map = new Map<string, ValidationResult[]>();
  for (const r of results) {
    const key = endpointKey(r);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([key, rows]) => ({
      endpointKey: key,
      path: rows[0]?.path ?? "",
      method: rows[0]?.method ?? "",
      controller: rows[0]?.controller ?? "",
      results: rows,
      aggregate: validationAggregate(rows),
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export type FieldFailureSummary = {
  fieldPath: string;
  variant: string;
  count: number;
};

export function topFailureVariants(
  results: ValidationResult[],
  limit = 10
): FieldFailureSummary[] {
  const counts = new Map<string, FieldFailureSummary>();
  for (const r of results) {
    if (r.ok || r.outcome !== "fail") continue;
    const key = `${r.fieldPath}:${r.variant}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {
        fieldPath: r.fieldPath,
        variant: r.variant,
        count: 1,
      });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
