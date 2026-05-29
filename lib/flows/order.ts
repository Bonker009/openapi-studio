/**
 * Execution-order helpers. The `flow.steps` array is the authoritative run
 * order (the runner and `{{steps.N}}` refs are index-based). Canvas
 * `connections` are the user-drawn wiring; when present they define the order
 * and the steps array is reordered to match via a topological sort.
 */
import type { Flow, FlowConnection, FlowStep } from "@/lib/flows/types";

/** Sequential chain matching the current array order: steps[i] -> steps[i+1]. */
export function linearConnections(steps: FlowStep[]): FlowConnection[] {
  const conns: FlowConnection[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    conns.push({ source: steps[i].id, target: steps[i + 1].id });
  }
  return conns;
}

/** True if adding source -> target would introduce a cycle. */
function createsCycle(
  conns: FlowConnection[],
  source: string,
  target: string
): boolean {
  if (source === target) return true;
  const adjacency = new Map<string, string[]>();
  for (const c of conns) {
    const list = adjacency.get(c.source) ?? [];
    list.push(c.target);
    adjacency.set(c.source, list);
  }
  // Reachable from target; if we can get back to source, the new edge closes a loop.
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const node = stack.pop() as string;
    if (node === source) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of adjacency.get(node) ?? []) stack.push(next);
  }
  return false;
}

/** Add a connection, ignoring duplicates and edges that would create a cycle. */
export function addConnection(
  conns: FlowConnection[],
  source: string,
  target: string
): FlowConnection[] {
  if (source === target) return conns;
  if (conns.some((c) => c.source === source && c.target === target)) {
    return conns;
  }
  if (createsCycle(conns, source, target)) return conns;
  return [...conns, { source, target }];
}

/** Remove a specific connection. */
export function removeConnection(
  conns: FlowConnection[],
  source: string,
  target: string
): FlowConnection[] {
  return conns.filter((c) => !(c.source === source && c.target === target));
}

/** Drop any connections that reference a removed step id. */
export function pruneConnections(
  conns: FlowConnection[],
  stepIds: Set<string>
): FlowConnection[] {
  return conns.filter((c) => stepIds.has(c.source) && stepIds.has(c.target));
}

/**
 * Topologically sort the steps using `flow.connections`. Falls back to the
 * existing array order when there are no connections or a cycle is detected.
 */
export function orderSteps(flow: Flow): FlowStep[] {
  const conns = flow.connections;
  if (!conns || conns.length === 0) return flow.steps;

  const indexById = new Map(flow.steps.map((s, i) => [s.id, i] as const));
  const validConns = conns.filter(
    (c) => indexById.has(c.source) && indexById.has(c.target)
  );

  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const s of flow.steps) {
    indegree.set(s.id, 0);
    adjacency.set(s.id, []);
  }
  for (const c of validConns) {
    adjacency.get(c.source)?.push(c.target);
    indegree.set(c.target, (indegree.get(c.target) ?? 0) + 1);
  }

  // Kahn's algorithm; ready queue kept sorted by original array index so the
  // result is deterministic and disconnected steps keep their relative order.
  const ready = flow.steps
    .filter((s) => (indegree.get(s.id) ?? 0) === 0)
    .map((s) => s.id);
  const orderedIds: string[] = [];
  const byIndex = (a: string, b: string) =>
    (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0);

  ready.sort(byIndex);
  while (ready.length) {
    const id = ready.shift() as string;
    orderedIds.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const deg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, deg);
      if (deg === 0) {
        ready.push(next);
        ready.sort(byIndex);
      }
    }
  }

  // Cycle: not every node was emitted. Fall back to array order.
  if (orderedIds.length !== flow.steps.length) return flow.steps;

  const stepLookup = new Map(flow.steps.map((s) => [s.id, s] as const));
  return orderedIds
    .map((id) => stepLookup.get(id))
    .filter((s): s is FlowStep => Boolean(s));
}

/** The steps array reordered to match the connection wiring. */
export function reorderStepsByConnections(flow: Flow): FlowStep[] {
  return orderSteps(flow);
}
