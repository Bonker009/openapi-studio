import type { Flow, FlowConnection, FlowStep } from "@/domain/flows/types";

export function linearConnections(steps: FlowStep[]): FlowConnection[] {
  const conns: FlowConnection[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    conns.push({ source: steps[i].id, target: steps[i + 1].id, kind: "seq" });
  }
  return conns;
}

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

export function addConnection(
  conns: FlowConnection[],
  source: string,
  target: string,
  kind: FlowConnection["kind"] = "seq",
  sourceHandle?: string,
  targetHandle?: string
): FlowConnection[] {
  if (source === target) return conns;
  if (conns.some((c) => c.source === source && c.target === target && (c.kind ?? "seq") === (kind ?? "seq"))) {
    return conns;
  }
  if (
    (kind === "true" || kind === "false") &&
    conns.some((c) => c.source === source && (c.kind ?? "seq") === kind)
  ) {
    return conns;
  }
  if (createsCycle(conns, source, target)) return conns;
  return [
    ...conns,
    {
      source,
      target,
      kind: kind ?? "seq",
      sourceHandle,
      targetHandle,
    },
  ];
}

export function removeConnection(
  conns: FlowConnection[],
  source: string,
  target: string,
  kind?: FlowConnection["kind"]
): FlowConnection[] {
  return conns.filter(
    (c) =>
      !(
        c.source === source &&
        c.target === target &&
        (kind ? (c.kind ?? "seq") === kind : true)
      )
  );
}

export function pruneConnections(
  conns: FlowConnection[],
  stepIds: Set<string>
): FlowConnection[] {
  return conns.filter((c) => stepIds.has(c.source) && stepIds.has(c.target));
}

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

  if (orderedIds.length !== flow.steps.length) return flow.steps;

  const stepLookup = new Map(flow.steps.map((s) => [s.id, s] as const));
  return orderedIds
    .map((id) => stepLookup.get(id))
    .filter((s): s is FlowStep => Boolean(s));
}

export function reorderStepsByConnections(flow: Flow): FlowStep[] {
  return orderSteps(flow);
}
