import { flowSchemaZod } from "@/domain/ai/schemas/flow-schema.zod";
import type { FlowSchema } from "@/domain/ai/types";
import type { EndpointCatalogEntry } from "@/domain/ai/validation/endpoint-catalog";
import { normalizeEndpointRef } from "@/domain/ai/validation/endpoint-catalog";
import type { FlowValidationResult, ValidationIssue } from "@/domain/ai/types";

function issue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

export function validateFlowSchema(
  flow: FlowSchema,
  catalog: EndpointCatalogEntry[]
): FlowValidationResult {
  const errors: ValidationIssue[] = [];
  const parsed = flowSchemaZod.safeParse(flow);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      errors.push(
        issue("schema", err.message, err.path.map(String).join("."))
      );
    }
    return { valid: false, errors };
  }

  const allowed = new Set(catalog.map((c) => c.endpointKey));
  const nodeIds = new Set<string>();
  for (const node of flow.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(issue("duplicate_node", `Duplicate node id ${node.id}`, node.id));
    }
    nodeIds.add(node.id);
    const key = normalizeEndpointRef(node.endpoint);
    if (!allowed.has(key)) {
      errors.push(
        issue(
          "unknown_endpoint",
          `Endpoint not in OpenAPI catalog: ${node.endpoint}`,
          node.id
        )
      );
    }
  }

  if (flow.nodes.length === 0) {
    errors.push(issue("no_nodes", "Flow must contain at least one node"));
  }

  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }

  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(
        issue(
          "invalid_edge",
          `Edge references unknown node: ${edge.from} -> ${edge.to}`
        )
      );
      continue;
    }
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const starts = [...nodeIds].filter((id) => (inDegree.get(id) ?? 0) === 0);
  const ends = [...nodeIds].filter((id) => (outDegree.get(id) ?? 0) === 0);
  if (starts.length === 0) {
    errors.push(issue("no_start", "Flow must have a start node (no incoming edges)"));
  }
  if (ends.length === 0) {
    errors.push(issue("no_end", "Flow must have an end node (no outgoing edges)"));
  }

  const reachable = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const edge of flow.edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }
  const queue = [...starts];
  for (const s of starts) reachable.add(s);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  for (const id of nodeIds) {
    if (!reachable.has(id)) {
      errors.push(issue("orphan_node", `Orphan node not reachable: ${id}`, id));
    }
  }

  return { valid: errors.length === 0, errors };
}
