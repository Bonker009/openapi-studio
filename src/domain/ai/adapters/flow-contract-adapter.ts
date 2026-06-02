import { declarativeStepToLegacy } from "@/domain/flows/services/flow-adapter";
import type { DeclarativeStep } from "@/domain/flows/types/schema";
import type { Flow, FlowStep } from "@/domain/flows/types";
import { newStepId } from "@/domain/flows/types";
import type { FlowSchema } from "@/domain/ai/types";
import { normalizeEndpointRef } from "@/domain/ai/validation/endpoint-catalog";

function parseEndpoint(endpoint: string): { method: string; path: string } {
  const key = normalizeEndpointRef(endpoint);
  const idx = key.indexOf(":");
  if (idx < 0) return { method: "GET", path: endpoint };
  return {
    method: key.slice(0, idx),
    path: key.slice(idx + 1),
  };
}

function topologicalOrder(flow: FlowSchema): string[] {
  const ids = flow.nodes.map((n) => n.id);
  const inDeg = new Map(ids.map((id) => [id, 0]));
  const adj = new Map<string, string[]>();
  for (const e of flow.edges) {
    if (e.type === "failure") continue;
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }
  const queue = ids.filter((id) => (inDeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (inDeg.get(next) ?? 0) - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  for (const id of ids) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

export function flowSchemaToInternalFlow(input: {
  specId: string;
  name: string;
  baseUrl: string;
  flowSchema: FlowSchema;
}): Flow {
  const order = topologicalOrder(input.flowSchema);
  const nodeById = new Map(input.flowSchema.nodes.map((n) => [n.id, n]));
  const now = Date.now();

  const steps: FlowStep[] = order
    .map((id) => nodeById.get(id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((node, index) => {
      const { method, path } = parseEndpoint(node.endpoint);
      const url = `${input.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
      const declarative: DeclarativeStep = {
        id: node.id || newStepId(),
        name: node.name || `${method} ${path}`,
        request: {
          method: method as DeclarativeStep["request"]["method"],
          url,
          headers: {},
          query: {},
        },
        extract:
          index === 0 && /login|auth|token/i.test(node.endpoint)
            ? [{ name: "accessToken", source: "body", path: "access_token" }]
            : undefined,
      };
      return declarativeStepToLegacy(declarative);
    });

  const connections = input.flowSchema.edges.map((e) => ({
    source: e.from,
    target: e.to,
  }));

  return {
    id: `flow-ai-${now}`,
    specId: input.specId,
    name: input.name,
    baseUrl: input.baseUrl,
    steps,
    connections,
    onStepFailure: "stop",
    createdAt: now,
    updatedAt: now,
    auth:
      steps.length > 0
        ? undefined
        : undefined,
  };
}

export function flowSchemaToLegacySteps(
  flowSchema: FlowSchema,
  baseUrl: string
): FlowStep[] {
  return flowSchemaToInternalFlow({
    specId: "",
    name: "temp",
    baseUrl,
    flowSchema,
  }).steps;
}
