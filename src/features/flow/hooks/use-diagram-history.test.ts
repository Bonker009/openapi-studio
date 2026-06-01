import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diagramSnapshot } from "./use-diagram-history";
import type { Flow } from "@/domain/flows/types";

function minimalFlow(overrides?: Partial<Flow>): Flow {
  return {
    id: "f1",
    specId: "s",
    name: "Test",
    steps: [],
    onStepFailure: "stop",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("diagramSnapshot", () => {
  it("changes when diagram positions change", () => {
    const a = minimalFlow({
      steps: [
        {
          id: "s1",
          endpointKey: "GET:/a",
          paramValues: {},
          headerValues: {},
          extractions: [],
        },
      ],
      diagramPositions: { s1: { x: 0, y: 0 } },
    });
    const b = {
      ...a,
      diagramPositions: { s1: { x: 100, y: 0 } },
    };
    assert.notEqual(diagramSnapshot(a), diagramSnapshot(b));
  });

  it("ignores executionMode changes", () => {
    const a = minimalFlow({ executionMode: "sequential" });
    const b = minimalFlow({ executionMode: "parallel" });
    assert.equal(diagramSnapshot(a), diagramSnapshot(b));
  });
});
