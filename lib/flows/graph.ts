/** Derive data-dependency edges between flow steps from their {{...}} tokens. */
import type { FlowStep } from "@/lib/flows/types";
import { extractTokenRefs } from "@/lib/flows/resolve-refs";

/** Map each captured variable name to the index of the step that produces it. */
export function buildCaptureIndex(steps: FlowStep[]): Map<string, number> {
  const map = new Map<string, number>();
  steps.forEach((step, index) => {
    for (const ex of step.extractions) {
      if (ex.name.trim()) map.set(ex.name.trim(), index);
    }
  });
  return map;
}

/** All token-bearing strings used by a step (params, headers, body). */
function stepStrings(step: FlowStep): string[] {
  return [
    ...Object.values(step.paramValues),
    ...Object.values(step.headerValues),
    ...(step.body ? [step.body] : []),
  ];
}

export type FlowEdge = {
  /** Source step index. */
  from: number;
  /** Target step index. */
  to: number;
  /** Variable/field labels passed along this edge. */
  labels: string[];
};

/**
 * Compute data-dependency edges. Each edge points from the step producing a
 * value to the step consuming it (via {{vars.X}} or {{steps.N...}}).
 */
export function computeDependencyEdges(steps: FlowStep[]): FlowEdge[] {
  const captureIndex = buildCaptureIndex(steps);
  const edges = new Map<string, FlowEdge>();

  steps.forEach((step, to) => {
    for (const text of stepStrings(step)) {
      for (const ref of extractTokenRefs(text)) {
        let from: number | undefined;
        let label: string;

        if (ref.kind === "var") {
          from = captureIndex.get(ref.name);
          label = ref.name;
        } else if (
          ref.kind === "stepBody" ||
          ref.kind === "stepStatus" ||
          ref.kind === "stepHeader"
        ) {
          from = ref.stepIndex;
          label =
            ref.kind === "stepBody"
              ? `body.${ref.path}`
              : ref.kind === "stepHeader"
                ? `headers.${ref.header}`
                : "status";
        } else {
          continue;
        }

        if (from === undefined || from === to) continue;

        const key = `${from}->${to}`;
        const existing = edges.get(key);
        if (existing) {
          if (!existing.labels.includes(label)) existing.labels.push(label);
        } else {
          edges.set(key, { from, to, labels: [label] });
        }
      }
    }
  });

  return Array.from(edges.values());
}
