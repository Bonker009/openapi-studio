import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getByPath,
  resolveString,
  extractTokenRefs,
  type RunContext,
} from "@/lib/flows/resolve-refs";
import { computeDependencyEdges } from "@/lib/flows/graph";
import { flowLoginCredential, runFlow, type FlowExecutor } from "@/lib/flows/run-flow";
import { keyPathToAccessor } from "@/lib/flows/payload-tree";
import {
  flowEndpointKey,
  type Flow,
  type FlowStep,
  type StepRunResult,
} from "@/lib/flows/types";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import type { HttpRequestResult } from "@/lib/playground/http-request-core";

describe("getByPath", () => {
  it("traverses dot and bracket paths", () => {
    const obj = { data: [{ id: 7, name: "a" }, { id: 9 }] };
    assert.equal(getByPath(obj, "data[0].id"), 7);
    assert.equal(getByPath(obj, "data[1].id"), 9);
    assert.equal(getByPath(obj, "data.0.name"), "a");
  });

  it("returns undefined for missing paths", () => {
    assert.equal(getByPath({ a: 1 }, "b.c"), undefined);
    assert.equal(getByPath(null, "a"), undefined);
  });
});

describe("resolveString", () => {
  const ctx: RunContext = {
    vars: { productId: "abc", count: 3 },
    steps: [
      {
        status: 200,
        headers: { "x-token": "TKN" },
        body: { data: [{ id: 42 }] },
      },
    ],
  };

  it("resolves vars and step refs", () => {
    assert.equal(resolveString("{{vars.productId}}", ctx).value, "abc");
    assert.equal(resolveString("id={{vars.count}}", ctx).value, "id=3");
    assert.equal(resolveString("{{steps.0.status}}", ctx).value, "200");
    assert.equal(resolveString("{{steps.0.body.data[0].id}}", ctx).value, "42");
    assert.equal(resolveString("{{steps.0.headers.X-Token}}", ctx).value, "TKN");
  });

  it("flags missing references and leaves token intact", () => {
    const res = resolveString("{{vars.missing}}", ctx);
    assert.equal(res.value, "{{vars.missing}}");
    assert.deepEqual(res.missing, ["{{vars.missing}}"]);
  });
});

describe("computeDependencyEdges", () => {
  it("links a capture-producing step to its consumer", () => {
    const steps: FlowStep[] = [
      {
        id: "s1",
        endpointKey: "GET:/products",
        paramValues: {},
        headerValues: {},
        extractions: [{ name: "pid", source: "body", path: "data[0].id" }],
      },
      {
        id: "s2",
        endpointKey: "GET:/products/{id}",
        paramValues: { id: "{{vars.pid}}" },
        headerValues: {},
        extractions: [],
      },
    ];
    const edges = computeDependencyEdges(steps);
    assert.equal(edges.length, 1);
    assert.deepEqual(edges[0], { from: 0, to: 1, labels: ["pid"] });
  });
});

describe("extractTokenRefs", () => {
  it("parses var and step refs", () => {
    const refs = extractTokenRefs("{{vars.a}} {{steps.2.body.x.y}}");
    assert.equal(refs[0].kind, "var");
    assert.equal(refs[1].kind, "stepBody");
  });
});

function ep(method: string, path: string): PlaygroundEndpoint {
  return {
    method,
    path,
    controller: "t",
    parameters:
      path.includes("{id}")
        ? [{ name: "id", in: "path", required: true }]
        : [],
    hasRequestBody: false,
    requiresAuth: false,
  };
}

function makeFlow(steps: FlowStep[], onStepFailure: "stop" | "continue"): Flow {
  return {
    id: "f1",
    specId: "s",
    name: "f",
    steps,
    onStepFailure,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("runFlow", () => {
  it("chains a captured id into the next step", async () => {
    const endpoints = [ep("GET", "/products"), ep("GET", "/products/{id}")];
    const calls: string[] = [];
    const execute: FlowExecutor = async (url): Promise<HttpRequestResult> => {
      calls.push(url);
      if (url.endsWith("/products")) {
        return {
          data: { data: [{ id: "p99" }] },
          status: 200,
          statusText: "OK",
          headers: {},
          responseTime: 1,
        };
      }
      return {
        data: { id: "p99", name: "Widget" },
        status: 200,
        statusText: "OK",
        headers: {},
        responseTime: 1,
      };
    };

    const flow = makeFlow(
      [
        {
          id: "s1",
          endpointKey: flowEndpointKey(endpoints[0]),
          paramValues: {},
          headerValues: {},
          extractions: [{ name: "pid", source: "body", path: "data[0].id" }],
        },
        {
          id: "s2",
          endpointKey: flowEndpointKey(endpoints[1]),
          paramValues: { id: "{{vars.pid}}" },
          headerValues: {},
          extractions: [],
        },
      ],
      "stop"
    );

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
    });

    assert.equal(result.outcome, "pass");
    assert.ok(calls[1].includes("/products/p99"));
    assert.equal(result.steps[0].capturedVars.pid, "p99");
  });

  it("stops and skips remaining steps on failure when policy is stop", async () => {
    const endpoints = [ep("GET", "/a"), ep("GET", "/b")];
    const execute: FlowExecutor = async (url): Promise<HttpRequestResult> => ({
      data: null,
      status: url.endsWith("/a") ? 500 : 200,
      statusText: "",
      headers: {},
      responseTime: 1,
    });
    const flow = makeFlow(
      [
        {
          id: "s1",
          endpointKey: flowEndpointKey(endpoints[0]),
          paramValues: {},
          headerValues: {},
          extractions: [],
        },
        {
          id: "s2",
          endpointKey: flowEndpointKey(endpoints[1]),
          paramValues: {},
          headerValues: {},
          extractions: [],
        },
      ],
      "stop"
    );

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
    });

    assert.equal(result.steps[0].outcome, "fail");
    assert.equal(result.steps[1].outcome, "skipped");
  });

  it("errors a step with unresolved references without firing a request", async () => {
    const endpoints = [ep("GET", "/products/{id}")];
    let called = false;
    const execute: FlowExecutor = async (): Promise<HttpRequestResult> => {
      called = true;
      return {
        data: null,
        status: 200,
        statusText: "",
        headers: {},
        responseTime: 1,
      };
    };
    const flow = makeFlow(
      [
        {
          id: "s1",
          endpointKey: flowEndpointKey(endpoints[0]),
          paramValues: { id: "{{vars.missing}}" },
          headerValues: {},
          extractions: [],
        },
      ],
      "continue"
    );

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
    });

    assert.equal(called, false);
    assert.equal(result.steps[0].outcome, "error");
  });

  it("pauses after each step when stepThrough is set and applies live captures", async () => {
    const endpoints = [ep("GET", "/products"), ep("GET", "/products/{id}")];
    const calls: string[] = [];
    const execute: FlowExecutor = async (url): Promise<HttpRequestResult> => {
      calls.push(url);
      return {
        data: { data: [{ id: "live-1" }] },
        status: 200,
        statusText: "OK",
        headers: {},
        responseTime: 1,
      };
    };
    const flow = makeFlow(
      [
        {
          id: "s1",
          endpointKey: flowEndpointKey(endpoints[0]),
          paramValues: {},
          headerValues: {},
          extractions: [],
        },
        {
          id: "s2",
          endpointKey: flowEndpointKey(endpoints[1]),
          paramValues: { id: "{{vars.pid}}" },
          headerValues: {},
          extractions: [],
        },
      ],
      "stop"
    );

    const pausedAt: number[] = [];
    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
      stepThrough: true,
      onPause: async (info) => {
        pausedAt.push(info.index);
        if (info.index === 0) {
          return {
            action: "continue",
            extraCaptures: [{ name: "pid", source: "body", path: "data[0].id" }],
          };
        }
        return { action: "continue" };
      },
    });

    assert.deepEqual(pausedAt, [0, 1]);
    assert.equal(result.steps[0].capturedVars.pid, "live-1");
    assert.ok(calls[1].includes("/products/live-1"));
  });

  it("stops the run when a pause decision is stop", async () => {
    const endpoints = [ep("GET", "/a"), ep("GET", "/b")];
    const execute: FlowExecutor = async (): Promise<HttpRequestResult> => ({
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      responseTime: 1,
    });
    const flow = makeFlow(
      [
        {
          id: "s1",
          endpointKey: flowEndpointKey(endpoints[0]),
          paramValues: {},
          headerValues: {},
          extractions: [],
          pauseAfter: true,
        },
        {
          id: "s2",
          endpointKey: flowEndpointKey(endpoints[1]),
          paramValues: {},
          headerValues: {},
          extractions: [],
        },
      ],
      "continue"
    );

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
      onPause: async () => ({ action: "stop" }),
    });

    assert.equal(result.steps[0].outcome, "pass");
    assert.equal(result.steps[1].outcome, "skipped");
  });

  it("resumes from a later step, reusing seeded context without re-running earlier steps", async () => {
    const endpoints = [ep("GET", "/products"), ep("GET", "/products/{id}")];
    const calls: string[] = [];
    const execute: FlowExecutor = async (url): Promise<HttpRequestResult> => {
      calls.push(url);
      return {
        data: { id: "p99", name: "Widget" },
        status: 200,
        statusText: "OK",
        headers: {},
        responseTime: 1,
      };
    };

    const flow = makeFlow(
      [
        {
          id: "s1",
          endpointKey: flowEndpointKey(endpoints[0]),
          paramValues: {},
          headerValues: {},
          extractions: [{ name: "pid", source: "body", path: "data[0].id" }],
        },
        {
          id: "s2",
          endpointKey: flowEndpointKey(endpoints[1]),
          paramValues: { id: "{{vars.pid}}" },
          headerValues: {},
          extractions: [],
        },
      ],
      "stop"
    );

    const priorStep0: StepRunResult = {
      stepId: "s1",
      index: 0,
      endpointKey: flowEndpointKey(endpoints[0]),
      method: "GET",
      path: "/products",
      outcome: "pass",
      status: 200,
      latencyMs: 1,
      capturedVars: { pid: "seeded-1" },
    };

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
      startIndex: 1,
      priorResults: [priorStep0],
      seedContext: {
        vars: { pid: "seeded-1" },
        steps: [{ status: 200, headers: {}, body: { data: [{ id: "seeded-1" }] } }],
      },
    });

    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("/products/seeded-1"));
    assert.equal(result.steps[0], priorStep0);
    assert.equal(result.steps[1].outcome, "pass");
    assert.equal(result.outcome, "pass");
  });

  it("uses a captured login token for downstream Flow-default steps", async () => {
    const endpoints = [
      { ...ep("POST", "/auth/login"), hasRequestBody: true },
      { ...ep("GET", "/me"), requiresAuth: true },
    ];
    const authHeaders: string[] = [];
    const execute: FlowExecutor = async (url, init): Promise<HttpRequestResult> => {
      const h = new Headers(init.headers);
      const auth = h.get("Authorization");
      if (auth) authHeaders.push(auth);
      if (url.endsWith("/auth/login")) {
        return {
          data: { accessToken: "tok-xyz" },
          status: 200,
          statusText: "OK",
          headers: {},
          responseTime: 1,
        };
      }
      return {
        data: { user: "alice" },
        status: 200,
        statusText: "OK",
        headers: {},
        responseTime: 1,
      };
    };

    const flow: Flow = {
      ...makeFlow(
        [
          {
            id: "login",
            endpointKey: flowEndpointKey(endpoints[0]),
            paramValues: {},
            headerValues: {},
            extractions: [
              { name: "token", source: "body", path: "accessToken" },
            ],
          },
          {
            id: "me",
            endpointKey: flowEndpointKey(endpoints[1]),
            paramValues: {},
            headerValues: {},
            extractions: [],
          },
        ],
        "stop"
      ),
      auth: { loginStepId: "login", tokenVar: "token", scheme: "bearer" },
    };

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
    });

    assert.equal(result.outcome, "pass");
    assert.equal(result.steps[1].roleUsed, "Login token");
    assert.equal(authHeaders[0], "Bearer tok-xyz");
  });

  it("flowLoginCredential returns null when token var is missing", () => {
    const flow: Flow = {
      ...makeFlow([], "stop"),
      auth: { loginStepId: "s1", tokenVar: "token" },
    };
    assert.equal(flowLoginCredential(flow, { vars: {}, steps: [] }), null);
    const cred = flowLoginCredential(flow, { vars: { token: "abc" }, steps: [] });
    assert.equal(cred?.type === "bearer" ? cred.token : null, "abc");
  });

  it("returns the run context for later resumes", async () => {
    const endpoints = [ep("GET", "/products")];
    const execute: FlowExecutor = async (): Promise<HttpRequestResult> => ({
      data: { data: [{ id: "ctx-1" }] },
      status: 200,
      statusText: "OK",
      headers: { "x-trace": "abc" },
      responseTime: 1,
    });
    const flow = makeFlow(
      [
        {
          id: "s1",
          endpointKey: flowEndpointKey(endpoints[0]),
          paramValues: {},
          headerValues: {},
          extractions: [{ name: "pid", source: "body", path: "data[0].id" }],
        },
      ],
      "stop"
    );

    const result = await runFlow({
      flow,
      endpoints,
      baseUrl: "http://api.test",
      credentials: [],
      defaultCredential: null,
      execute,
    });

    assert.equal(result.context?.vars.pid, "ctx-1");
    assert.equal(result.context?.steps[0]?.status, 200);
  });
});

describe("keyPathToAccessor", () => {
  it("converts a leaf-first keyPath (incl. root) to a dot/bracket accessor", () => {
    assert.equal(keyPathToAccessor(["id", 0, "data", "root"]), "data[0].id");
    assert.equal(keyPathToAccessor(["name", "user", "root"]), "user.name");
    assert.equal(keyPathToAccessor(["root"]), "");
    assert.equal(keyPathToAccessor([0, "items", "root"]), "items[0]");
  });

  it("converts hideRoot keyPaths (no synthetic root segment)", () => {
    assert.equal(
      keyPathToAccessor(["generationId", 0, "payload"]),
      "payload[0].generationId"
    );
    assert.equal(keyPathToAccessor(["success"]), "success");
  });
});

describe("getByPath with ApiResponse payload", () => {
  it("reads generationId from a list payload wrapper", () => {
    const body = {
      success: true,
      payload: [{ generationId: "gen-abc", name: "2024" }],
    };
    assert.equal(
      getByPath(body, keyPathToAccessor(["generationId", 0, "payload"])),
      "gen-abc"
    );
  });
});
