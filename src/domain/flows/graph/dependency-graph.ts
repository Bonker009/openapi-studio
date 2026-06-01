import { extractTokenRefs } from "@/domain/flows/requests/variable-resolver";
import type { FlowStep } from "@/domain/flows/types";

export function buildCaptureIndex(steps: FlowStep[]): Map<string, number> {
  const map = new Map<string, number>();
  steps.forEach((step, index) => {
    for (const ex of step.extractions) {
      if (ex.name.trim()) map.set(ex.name.trim(), index);
    }
  });
  return map;
}

function stepStrings(step: FlowStep): string[] {
  return [
    ...Object.values(step.paramValues),
    ...Object.values(step.headerValues),
    ...(step.body ? [step.body] : []),
  ];
}

export type FlowEdge = {
  from: number;
  to: number;
  labels: string[];
};

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
