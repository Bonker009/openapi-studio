import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateConditionalRule } from "@/domain/flows/requests/step-condition";
import { createRunContext, type Flow } from "@/lib/flows/types";
import { runFlow, type FlowExecutor } from "@/lib/flows/run-flow";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import type { HttpRequestResult } from "@/lib/playground/http-request-core";

function endpoint(method: string, path: string): PlaygroundEndpoint {
  return {
    method,
    path,
    controller: "test",
    parameters: [],
    hasRequestBody: false,
    requiresAuth: false,
  };
}

describe("evaluateConditionalRule", () => {
  it("supports equals and contains operators", () => {
    const ctx = createRunContext({ vars: { state: "approved", note: "hello world" } });
    const equals = evaluateConditionalRule(
      { left: "{{vars.state}}", operator: "equals", right: "approved" },
      ctx
    );
    const contains = evaluateConditionalRule(
      { left: "{{vars.note}}", operator: "contains", right: "world" },
      ctx
    );
    assert.equal(equals.value, true);
    assert.equal(contains.value, true);
  });

  it("supports numeric comparison operators", () => {
    const ctx = createRunContext({ vars: { count: 5 } });
    const gt = evaluateConditionalRule(
      { left: "{{vars.count}}", operator: "gt", right: "3" },
      ctx
    );
    const lte = evaluateConditionalRule(
      { left: "{{vars.count}}", operator: "lte", right: "5" },
      ctx
    );
    assert.equal(gt.value, true);
    assert.equal(lte.value, true);
  });
});

describe("conditional flow branching", () => {
  it("takes true branch and skips false branch", async () => {
    const endpoints = [endpoint("GET", "/a"), endpoint("GET", "/b")];
    const calls: string[] = [];
    const execute: FlowExecutor = async (url): Promise<HttpRequestResult> => {
      calls.push(url);
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        responseTime: 1,
      };
    };

    const flow: Flow = {
      id: "f",
      specId: "s",
      name: "conditional",
      executionMode: "conditional",
      onStepFailure: "stop",
      createdAt: 0,
      updatedAt: 0,
      steps: [
        {
          id: "cond",
          stepKind: "conditional",
          name: "if ok",
          endpointKey: "CONDITION:branch",
          paramValues: {},
          headerValues: {},
          extractions: [],
          conditional: { left: "{{vars.flag}}", operator: "equals", right: "yes" },
        },
        {
          id: "t",
          endpointKey: "GET:/a",
          paramValues: {},
          headerValues: {},
          extractions: [],
        },
        {
          id: "f",
          endpointKey: "GET:/b",
          paramValues: {},
          headerValues: {},
          extractions: [],
        },
      ],
      connections: [
        { source: "cond", target: "t", kind: "true" },
        { source: "cond", target: "f", kind: "false" },
      ],
      variables: { flag: "yes" },
    };

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
    });

    assert.equal(result.steps.find((s) => s.stepId === "cond")?.outcome, "pass");
    assert.equal(result.steps.find((s) => s.stepId === "t")?.outcome, "pass");
    assert.equal(result.steps.find((s) => s.stepId === "f")?.outcome, "skipped");
    assert.equal(calls.length, 1);
    assert.ok(calls[0]?.includes("/a"));
  });
});
