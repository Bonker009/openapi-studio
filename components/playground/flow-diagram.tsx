"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  MarkerType,
  Panel,
  Handle,
  Position,
  useReactFlow,
  useNodesState,
  useEdgesState,
  useViewport,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Grid2x2,
  Map as MapIcon,
  Maximize,
  Play,
  Plus,
  Search,
  Trash2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/method-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FlowStepCard } from "@/components/playground/flow-step-card";
import { LiveJsonTree } from "@/components/playground/live-json-tree";
import { isJsonTreeValue } from "@/lib/playground/json-format";
import type { Credential } from "@/lib/playground/credentials";
import {
  groupEndpointsByController,
  type PlaygroundEndpoint,
} from "@/lib/playground/endpoints";
import { computeDependencyEdges } from "@/lib/flows/graph";
import {
  addConnection,
  linearConnections,
  orderSteps,
  pruneConnections,
  removeConnection,
  reorderStepsByConnections,
} from "@/lib/flows/order";
import {
  createFlowStepFromEndpoint,
  type FlowApiData,
} from "@/lib/flows/step-defaults";
import { layoutWithElk } from "@/lib/flows/layout";
import {
  defaultDiagramPosition,
  DIAGRAM_NODE_H,
  DIAGRAM_NODE_W,
  flowEndpointKey,
  MAX_FLOW_STEPS,
  newStepId,
  type Flow,
  type FlowConnection,
  type FlowStep,
  type StepRunResult,
} from "@/lib/flows/types";
import { cn } from "@/lib/utils";

const DND_MIME = "application/x-flow-endpoint";

type FlowDiagramProps = {
  flow: Flow;
  endpoints: PlaygroundEndpoint[];
  apiData: FlowApiData;
  baseUrl: string;
  credentials: Credential[];
  results?: StepRunResult[];
  runningIndex?: number | null;
  /** When true, re-fit the viewport (call after the tab becomes visible). */
  visible?: boolean;
  selectedStepId: string | null;
  onSelectStep: (stepId: string | null) => void;
  onRunFromStep?: (stepId: string) => void;
  onChange: (flow: Flow) => void;
};

type StepNodeData = {
  label: string;
  method: string;
  role?: string;
  statusClass: string;
  selected: boolean;
  outcome?: StepRunResult["outcome"];
  index: number;
  error?: string;
  responseBody?: unknown;
  responseBodyPreview?: string;
  onRunFromHere?: () => void;
};

function statusColor(
  outcome: StepRunResult["outcome"] | undefined,
  running: boolean
): string {
  if (running) return "border-primary bg-primary/10";
  switch (outcome) {
    case "pass":
      return "border-success bg-success/10";
    case "fail":
      return "border-amber-500 bg-amber-500/10";
    case "error":
      return "border-destructive bg-destructive/10";
    case "skipped":
      return "border-muted-foreground/40 bg-muted/50";
    default:
      return "border-border bg-card";
  }
}

function StepNode({ data }: { data: StepNodeData }) {
  const [showError, setShowError] = useState(false);
  const failed = data.outcome === "fail" || data.outcome === "error";
  const errorLabel =
    data.error ?? (data.outcome === "error" ? "Request error" : "Step failed");

  return (
    <div
      className={cn(
        "relative w-[220px] rounded-lg border-2 px-3 py-2 text-left shadow-sm transition-colors",
        data.statusClass,
        data.selected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!w-2.5 !h-2.5 !bg-muted-foreground !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1">
        <MethodBadge method={data.method} />
        {data.role && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground truncate max-w-[100px]">
            {data.role}
          </span>
        )}
      </div>
      <p className="text-xs font-mono truncate">{data.label}</p>

      {failed && (
        <div className="mt-1.5 border-t border-border/60 pt-1.5">
          <button
            type="button"
            className="nodrag flex w-full items-center gap-1 text-left text-[10px] font-medium text-destructive"
            aria-expanded={showError}
            aria-label={
              showError
                ? `Hide error details for ${data.label}`
                : `Show error details for ${data.label}`
            }
            onClick={(e) => {
              e.stopPropagation();
              setShowError((v) => !v);
            }}
          >
            {showError ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">{errorLabel}</span>
          </button>

          {showError && (
            <div
              role="region"
              aria-label={`Error details for ${data.label}`}
              className="nodrag nowheel mt-1 space-y-1"
            >
              {data.error && (
                <p className="text-[10px] text-destructive break-words">
                  {data.error}
                </p>
              )}
              <div className="overflow-hidden rounded border border-border">
                <p className="border-b border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Response
                </p>
                {isJsonTreeValue(data.responseBody) ? (
                  <LiveJsonTree
                    value={data.responseBody}
                    variant="minimal"
                    hideRoot
                  />
                ) : (
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words p-1.5 text-[10px] font-mono text-foreground">
                    {data.responseBodyPreview ?? "No response body"}
                  </pre>
                )}
              </div>
              {data.onRunFromHere && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="nodrag h-6 w-full gap-1 text-[10px]"
                  aria-label={`Run flow from ${data.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onRunFromHere?.();
                  }}
                >
                  <Play className="h-2.5 w-2.5" />
                  Run from here
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

const nodeTypes = { flowStep: memo(StepNode) };

/** Connections used for rendering/ordering: explicit if present, else linear. */
function effectiveConnections(flow: Flow): FlowConnection[] {
  return flow.connections && flow.connections.length > 0
    ? flow.connections
    : linearConnections(flow.steps);
}

function buildNodesAndEdges(
  flow: Flow,
  endpoints: PlaygroundEndpoint[],
  resultByStepId: Map<string, StepRunResult>,
  runningIndex: number | null | undefined,
  selectedStepId: string | null,
  onRunFromStep?: (stepId: string) => void
): { nodes: Node[]; edges: Edge[] } {
  const depEdges = computeDependencyEdges(flow.steps);
  const positions = flow.diagramPositions ?? {};

  const nodes: Node[] = flow.steps.map((step: FlowStep, index) => {
    const ep = endpoints.find((e) => flowEndpointKey(e) === step.endpointKey);
    const result = resultByStepId.get(step.id);
    const running = runningIndex === index;
    const role =
      step.credentialName === "No auth"
        ? "No auth"
        : step.credentialName ?? "Default";
    const position = positions[step.id] ?? defaultDiagramPosition(index);

    return {
      id: step.id,
      type: "flowStep",
      position,
      width: DIAGRAM_NODE_W,
      data: {
        label: ep?.path ?? step.endpointKey,
        method: ep?.method ?? "GET",
        role,
        statusClass: statusColor(result?.outcome, running),
        selected: selectedStepId === step.id,
        outcome: result?.outcome,
        index,
        error: result?.error,
        responseBody: result?.responseBody,
        responseBodyPreview: result?.responseBodyPreview,
        onRunFromHere: onRunFromStep
          ? () => onRunFromStep(step.id)
          : undefined,
      } satisfies StepNodeData,
      selected: selectedStepId === step.id,
      draggable: true,
    };
  });

  const seqStroke = "var(--muted-foreground)";
  const depStroke = "var(--primary)";
  const stepIds = new Set(flow.steps.map((s) => s.id));

  const edges: Edge[] = [];
  for (const conn of effectiveConnections(flow)) {
    if (!stepIds.has(conn.source) || !stepIds.has(conn.target)) continue;
    edges.push({
      id: `seq:${conn.source}->${conn.target}`,
      source: conn.source,
      target: conn.target,
      sourceHandle: "source",
      targetHandle: "target",
      type: "smoothstep",
      animated: true,
      className: "flow-edge-seq",
      data: { kind: "seq" },
      deletable: true,
      reconnectable: true,
      style: { stroke: seqStroke, strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: seqStroke,
      },
    });
  }

  for (const e of depEdges) {
    const fromId = flow.steps[e.from]?.id;
    const toId = flow.steps[e.to]?.id;
    if (!fromId || !toId) continue;
    edges.push({
      id: `dep:${fromId}->${toId}`,
      source: fromId,
      target: toId,
      sourceHandle: "source",
      targetHandle: "target",
      type: "smoothstep",
      animated: true,
      className: "flow-edge-dep",
      data: { kind: "dep" },
      deletable: false,
      selectable: false,
      reconnectable: false,
      label: e.labels.join(", "),
      labelStyle: { fontSize: 10, fill: "var(--foreground)" },
      labelBgStyle: { fill: "var(--card)" },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: depStroke, strokeWidth: 2.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: depStroke,
      },
    });
  }

  return { nodes, edges };
}

function EndpointPalette({
  endpoints,
  onClose,
}: {
  endpoints: PlaygroundEndpoint[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        ep.controller.toLowerCase().includes(q) ||
        (ep.summary?.toLowerCase().includes(q) ?? false)
    );
  }, [endpoints, search]);

  const grouped = useMemo(
    () => groupEndpointsByController(filtered),
    [filtered]
  );
  const controllers = useMemo(
    () => Object.keys(grouped).sort((a, b) => a.localeCompare(b)),
    [grouped]
  );
  const searching = search.trim().length > 0;

  const toggle = (c: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <div className="absolute left-3 top-3 bottom-3 z-10 flex w-80 flex-col rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Endpoints
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-1 pb-2 text-[10px] text-muted-foreground">
          Drag an endpoint onto the canvas to add a step.
        </p>
        {controllers.length === 0 && (
          <p className="px-1 py-4 text-xs text-muted-foreground">
            No endpoints match.
          </p>
        )}
        {controllers.map((controller) => {
          const isCollapsed = !searching && collapsed.has(controller);
          return (
            <div key={controller} className="mb-1">
              <button
                type="button"
                onClick={() => toggle(controller)}
                className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{controller}</span>
                <span className="font-normal tabular-nums text-muted-foreground/70">
                  {grouped[controller].length}
                </span>
              </button>
              {!isCollapsed &&
                grouped[controller].map((ep) => (
                  <div
                    key={flowEndpointKey(ep)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_MIME, flowEndpointKey(ep));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="flex cursor-grab items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60 active:cursor-grabbing"
                    title={ep.summary ?? ep.path}
                  >
                    <MethodBadge method={ep.method} className="shrink-0" />
                    <span className="truncate font-mono text-xs">{ep.path}</span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type MenuKind = "node" | "edge" | "pane";

type MenuState = {
  x: number;
  y: number;
  kind: MenuKind;
  targetId?: string;
};

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
};

function CanvasContextMenu({
  state,
  items,
  onClose,
}: {
  state: MenuState | null;
  items: MenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [state, onClose]);

  if (!state || items.length === 0) return null;

  const left =
    typeof window !== "undefined"
      ? Math.min(state.x, window.innerWidth - 220)
      : state.x;
  const top =
    typeof window !== "undefined"
      ? Math.min(state.y, window.innerHeight - (items.length * 36 + 16))
      : state.y;

  return (
    <div
      role="menu"
      aria-label="Canvas actions"
      className="fixed z-50 min-w-[190px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted focus:bg-muted focus:outline-none",
            item.danger && "text-destructive"
          )}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function FlowCanvas({
  flow,
  endpoints,
  apiData,
  baseUrl,
  credentials,
  results = [],
  runningIndex,
  visible = true,
  selectedStepId,
  onSelectStep,
  onRunFromStep,
  onChange,
}: FlowDiagramProps) {
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, setCenter } =
    useReactFlow();
  const { zoom } = useViewport();
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const resultByStepId = useMemo(() => {
    const m = new Map<string, StepRunResult>();
    for (const r of results) m.set(r.stepId, r);
    return m;
  }, [results]);

  const layout = useMemo(
    () =>
      buildNodesAndEdges(
        flow,
        endpoints,
        resultByStepId,
        runningIndex,
        selectedStepId,
        onRunFromStep
      ),
    [flow, endpoints, resultByStepId, runningIndex, selectedStepId, onRunFromStep]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  useEffect(() => {
    if (!visible) return;
    const t = requestAnimationFrame(() => {
      const first = layout.nodes[0];
      if (first) {
        setCenter(
          first.position.x + DIAGRAM_NODE_W / 2,
          first.position.y + DIAGRAM_NODE_H / 2,
          { zoom: 1, duration: 200 }
        );
      }
    });
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-center at 100% when the tab becomes visible / step count changes
  }, [visible, flow.steps.length]);

  const persistPositions = useCallback(
    (id: string, x: number, y: number) => {
      onChange({
        ...flow,
        diagramPositions: {
          ...(flow.diagramPositions ?? {}),
          [id]: { x, y },
        },
      });
    },
    [flow, onChange]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      persistPositions(node.id, node.position.x, node.position.y);
    },
    [persistPositions]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const base = flow.connections ?? linearConnections(flow.steps);
      const nextConns = addConnection(base, conn.source, conn.target);
      if (nextConns === base) return;
      const reordered = reorderStepsByConnections({
        ...flow,
        connections: nextConns,
      });
      onChange({ ...flow, connections: nextConns, steps: reordered });
    },
    [flow, onChange]
  );

  const deleteSteps = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const steps = flow.steps.filter((s) => !idSet.has(s.id));
      const base = flow.connections ?? linearConnections(flow.steps);
      const connections = pruneConnections(base, new Set(steps.map((s) => s.id)));
      const positions = { ...(flow.diagramPositions ?? {}) };
      for (const id of ids) delete positions[id];
      onChange({ ...flow, steps, connections, diagramPositions: positions });
      if (selectedStepId && idSet.has(selectedStepId)) onSelectStep(null);
    },
    [flow, onChange, selectedStepId, onSelectStep]
  );

  const deleteSeqEdges = useCallback(
    (deleted: Edge[]) => {
      const seq = deleted.filter((e) => (e.data as { kind?: string })?.kind === "seq");
      if (seq.length === 0) return;
      let conns = flow.connections ?? linearConnections(flow.steps);
      for (const e of seq) conns = removeConnection(conns, e.source, e.target);
      const reordered = reorderStepsByConnections({ ...flow, connections: conns });
      onChange({ ...flow, connections: conns, steps: reordered });
    },
    [flow, onChange]
  );

  // Figma-style edge detach/re-attach: drag an endpoint to a new node to rewire,
  // or drop it on empty canvas to delete the connection.
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if ((oldEdge.data as { kind?: string })?.kind !== "seq") return;
      if (!newConnection.source || !newConnection.target) return;
      edgeReconnectSuccessful.current = true;
      const base = flow.connections ?? linearConnections(flow.steps);
      const removed = removeConnection(base, oldEdge.source, oldEdge.target);
      const added = addConnection(
        removed,
        newConnection.source,
        newConnection.target
      );
      // addConnection returns the same array when the new edge is a duplicate or
      // would create a cycle; in that case keep the original wiring untouched.
      if (added === removed) return;
      const reordered = reorderStepsByConnections({
        ...flow,
        connections: added,
      });
      onChange({ ...flow, connections: added, steps: reordered });
    },
    [flow, onChange]
  );

  const onReconnectEnd = useCallback(
    (_: unknown, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        deleteSeqEdges([edge]);
      }
      edgeReconnectSuccessful.current = true;
    },
    [deleteSeqEdges]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const key = event.dataTransfer.getData(DND_MIME);
      if (!key) return;
      if (flow.steps.length >= MAX_FLOW_STEPS) {
        toast.error(`A flow can have at most ${MAX_FLOW_STEPS} steps`);
        return;
      }
      const endpoint = endpoints.find((e) => flowEndpointKey(e) === key);
      if (!endpoint) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const step = createFlowStepFromEndpoint(endpoint, apiData, baseUrl);
      onChange({
        ...flow,
        steps: [...flow.steps, step],
        diagramPositions: {
          ...(flow.diagramPositions ?? {}),
          [step.id]: position,
        },
      });
      onSelectStep(step.id);
    },
    [flow, endpoints, apiData, baseUrl, screenToFlowPosition, onChange, onSelectStep]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const autoArrange = useCallback(async () => {
    const stepIds = flow.steps.map((s) => s.id);
    try {
      const positions = await layoutWithElk(stepIds, effectiveConnections(flow));
      onChange({ ...flow, diagramPositions: positions });
      requestAnimationFrame(() => void fitView({ padding: 0.25, duration: 200 }));
    } catch {
      const ordered = orderSteps(flow);
      const positions: Record<string, { x: number; y: number }> = {};
      ordered.forEach((s, i) => {
        positions[s.id] = defaultDiagramPosition(i);
      });
      onChange({ ...flow, diagramPositions: positions });
      requestAnimationFrame(() => void fitView({ padding: 0.25, duration: 200 }));
    }
  }, [flow, onChange, fitView]);

  const deleteSelected = useCallback(() => {
    const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
    if (selectedNodeIds.length > 0) {
      deleteSteps(selectedNodeIds);
      return;
    }
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedEdges.length > 0) deleteSeqEdges(selectedEdges);
  }, [nodes, edges, deleteSteps, deleteSeqEdges]);

  const duplicateStep = useCallback(
    (id: string) => {
      const orig = flow.steps.find((s) => s.id === id);
      if (!orig) return;
      if (flow.steps.length >= MAX_FLOW_STEPS) {
        toast.error(`A flow can have at most ${MAX_FLOW_STEPS} steps`);
        return;
      }
      const copy: FlowStep = { ...structuredClone(orig), id: newStepId() };
      const pos =
        flow.diagramPositions?.[id] ??
        defaultDiagramPosition(flow.steps.length);
      onChange({
        ...flow,
        steps: [...flow.steps, copy],
        diagramPositions: {
          ...(flow.diagramPositions ?? {}),
          [copy.id]: { x: pos.x + 40, y: pos.y + 40 },
        },
      });
      onSelectStep(copy.id);
    },
    [flow, onChange, onSelectStep]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onSelectStep(node.id),
    [onSelectStep]
  );

  const onPaneClick = useCallback(() => onSelectStep(null), [onSelectStep]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, kind: "node", targetId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    if ((edge.data as { kind?: string })?.kind !== "seq") return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, kind: "edge", targetId: edge.id });
  }, []);

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, kind: "pane" });
    },
    []
  );

  const menuItems = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    if (menu.kind === "node" && menu.targetId) {
      const targetId = menu.targetId;
      const result = resultByStepId.get(targetId);
      const failed =
        result?.outcome === "fail" || result?.outcome === "error";
      return [
        ...(failed && onRunFromStep
          ? [
              {
                label: "Run from here",
                icon: <Play className="h-3.5 w-3.5" />,
                onClick: () => onRunFromStep(targetId),
              },
            ]
          : []),
        {
          label: "Duplicate",
          icon: <Copy className="h-3.5 w-3.5" />,
          onClick: () => duplicateStep(targetId),
        },
        {
          label: "Delete",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => deleteSteps([targetId]),
        },
      ];
    }
    if (menu.kind === "edge" && menu.targetId) {
      const edge = edges.find((x) => x.id === menu.targetId);
      return [
        {
          label: "Detach / delete connection",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => {
            if (edge) deleteSeqEdges([edge]);
          },
        },
      ];
    }
    return [
      {
        label: "Add endpoint",
        icon: <Plus className="h-3.5 w-3.5" />,
        onClick: () => setPaletteOpen(true),
      },
      {
        label: "Auto-arrange",
        icon: <Wand2 className="h-3.5 w-3.5" />,
        onClick: () => void autoArrange(),
      },
      {
        label: "Fit view",
        icon: <Maximize className="h-3.5 w-3.5" />,
        onClick: () => void fitView({ padding: 0.25, duration: 200 }),
      },
    ];
  }, [
    menu,
    resultByStepId,
    onRunFromStep,
    duplicateStep,
    deleteSteps,
    edges,
    deleteSeqEdges,
    autoArrange,
    fitView,
  ]);

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={(deleted) => deleteSteps(deleted.map((n) => n.id))}
          onEdgesDelete={deleteSeqEdges}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          deleteKeyCode={["Backspace", "Delete"]}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true,
            style: { strokeWidth: 2, stroke: "var(--muted-foreground)" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "var(--muted-foreground)",
            },
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          panOnDrag
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          {showGrid && <Background variant={BackgroundVariant.Dots} gap={16} />}
          {showMiniMap && <MiniMap pannable zoomable />}

          <Panel position="top-center">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur">
              <ToolbarButton
                label={paletteOpen ? "Hide endpoints" : "Add endpoint"}
                active={paletteOpen}
                onClick={() => setPaletteOpen((v) => !v)}
              >
                <Plus className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Auto-arrange" onClick={() => void autoArrange()}>
                <Wand2 className="h-4 w-4" />
              </ToolbarButton>
              <Separator />
              <ToolbarButton label="Zoom out" onClick={() => void zoomOut()}>
                <ZoomOut className="h-4 w-4" />
              </ToolbarButton>
              <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <ToolbarButton label="Zoom in" onClick={() => void zoomIn()}>
                <ZoomIn className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Fit view"
                onClick={() => void fitView({ padding: 0.25, duration: 200 })}
              >
                <Maximize className="h-4 w-4" />
              </ToolbarButton>
              <Separator />
              <ToolbarButton
                label="Toggle minimap"
                active={showMiniMap}
                onClick={() => setShowMiniMap((v) => !v)}
              >
                <MapIcon className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Toggle grid"
                active={showGrid}
                onClick={() => setShowGrid((v) => !v)}
              >
                <Grid2x2 className="h-4 w-4" />
              </ToolbarButton>
              <Separator />
              <ToolbarButton label="Delete selected" onClick={deleteSelected}>
                <Trash2 className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {paletteOpen && (
        <EndpointPalette
          endpoints={endpoints}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {flow.steps.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-md bg-card/80 px-4 py-2 text-sm text-muted-foreground shadow">
            Drag an endpoint from the panel onto the canvas to add a step.
          </p>
        </div>
      )}

      <DiagramInspector
        flow={flow}
        endpoints={endpoints}
        apiData={apiData}
        baseUrl={baseUrl}
        credentials={credentials}
        selectedStepId={selectedStepId}
        resultByStepId={resultByStepId}
        runningIndex={runningIndex}
        onChange={onChange}
        onClose={() => onSelectStep(null)}
        onRunFromStep={onRunFromStep}
      />

      <CanvasContextMenu
        state={menu}
        items={menuItems}
        onClose={() => setMenu(null)}
      />
    </div>
  );
}

function Separator() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
        >
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function DiagramInspector({
  flow,
  endpoints,
  apiData,
  baseUrl,
  credentials,
  selectedStepId,
  resultByStepId,
  runningIndex,
  onChange,
  onClose,
  onRunFromStep,
}: {
  flow: Flow;
  endpoints: PlaygroundEndpoint[];
  apiData: FlowApiData;
  baseUrl: string;
  credentials: Credential[];
  selectedStepId: string | null;
  resultByStepId: Map<string, StepRunResult>;
  runningIndex?: number | null;
  onChange: (flow: Flow) => void;
  onClose: () => void;
  onRunFromStep?: (stepId: string) => void;
}) {
  const ordered = useMemo(() => orderSteps(flow), [flow]);
  const orderedIndex = ordered.findIndex((s) => s.id === selectedStepId);
  if (!selectedStepId || orderedIndex < 0) return null;
  const step = ordered[orderedIndex];
  const realIndex = flow.steps.findIndex((s) => s.id === selectedStepId);
  const selectedResult = resultByStepId.get(step.id);
  const selectedFailed =
    selectedResult?.outcome === "fail" || selectedResult?.outcome === "error";

  const updateStep = (next: FlowStep) => {
    const steps = [...flow.steps];
    steps[realIndex] = next;
    onChange({ ...flow, steps });
  };

  const removeStep = () => {
    const steps = flow.steps.filter((s) => s.id !== selectedStepId);
    const base = flow.connections ?? linearConnections(flow.steps);
    const connections = pruneConnections(base, new Set(steps.map((s) => s.id)));
    const positions = { ...(flow.diagramPositions ?? {}) };
    delete positions[selectedStepId];
    onChange({ ...flow, steps, connections, diagramPositions: positions });
    onClose();
  };

  return (
    <div className="absolute right-3 top-3 bottom-3 z-10 flex w-[440px] max-w-[90vw] flex-col rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step {orderedIndex + 1}
        </span>
        <div className="flex items-center gap-1">
          {selectedFailed && onRunFromStep && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-[11px]"
              aria-label={`Run flow from step ${orderedIndex + 1}`}
              onClick={() => onRunFromStep(step.id)}
            >
              <Play className="h-3 w-3" />
              Run from here
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <FlowStepCard
          step={step}
          index={orderedIndex}
          endpoints={endpoints}
          apiData={apiData}
          baseUrl={baseUrl}
          priorSteps={ordered.slice(0, orderedIndex)}
          credentials={credentials}
          open
          onOpenChange={() => {}}
          selected
          canMoveUp={false}
          canMoveDown={false}
          runResult={resultByStepId.get(step.id)}
          resultsByStepId={resultByStepId}
          isRunning={runningIndex === orderedIndex}
          onChange={updateStep}
          onRemove={removeStep}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
        />
      </div>
    </div>
  );
}

export function FlowDiagram(props: FlowDiagramProps) {
  return (
    <div className="flow-diagram flex h-full min-h-[400px] w-full flex-col">
      <ReactFlowProvider>
        <FlowCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
