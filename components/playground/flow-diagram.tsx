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
  NodeResizer,
  type NodeChange,
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
  KeyRound,
  Map as MapIcon,
  Maximize,
  Play,
  Plus,
  Search,
  Trash2,
  Redo2,
  Undo2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/method-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FlowStepInspector } from "@/components/playground/flow-step-inspector";
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
import {
  applyRunAsToAll,
  setFlowLoginStep,
  stepRoleLabel,
  type RunAsBulkValue,
} from "@/lib/flows/auth-helpers";
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
  type FlowSection,
  type FlowStep,
  type StepRunResult,
} from "@/lib/flows/types";
import { cn } from "@/lib/utils";
import { useDiagramHistory } from "@/features/flow/hooks/use-diagram-history";

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
  isLogin?: boolean;
  statusClass: string;
  selected: boolean;
  isConditional?: boolean;
  outcome?: StepRunResult["outcome"];
  index: number;
  error?: string;
  responseBody?: unknown;
  responseBodyPreview?: string;
  onRunFromHere?: () => void;
};

type SectionNodeData = {
  title: string;
  selected: boolean;
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

function StepErrorPopover({
  data,
}: {
  data: Pick<
    StepNodeData,
    "label" | "error" | "outcome" | "responseBody" | "responseBodyPreview" | "onRunFromHere"
  >;
}) {
  const [open, setOpen] = useState(false);
  const errorLabel =
    data.error ?? (data.outcome === "error" ? "Request error" : "Step failed");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="nodrag flex items-center justify-center rounded p-0.5 text-destructive hover:bg-destructive/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
              aria-label={`Error details for ${data.label}`}
              onClick={(e) => e.stopPropagation()}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-[11px]">
          {errorLabel}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        className="nodrag nowheel w-72 space-y-2 p-3 text-xs"
        side="right"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="break-words text-[11px] font-medium text-destructive leading-snug">
            {errorLabel}
          </p>
        </div>

        <div className="overflow-hidden rounded border border-border">
          <p className="border-b border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Response
          </p>
          {isJsonTreeValue(data.responseBody) ? (
            <LiveJsonTree value={data.responseBody} variant="minimal" hideRoot />
          ) : (
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words p-1.5 text-[10px] font-mono text-foreground">
              {data.responseBodyPreview ?? "No response body"}
            </pre>
          )}
        </div>

        {data.onRunFromHere && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full gap-1 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              data.onRunFromHere?.();
              setOpen(false);
            }}
          >
            <Play className="h-2.5 w-2.5" />
            Run from here
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StepNode({ data }: { data: StepNodeData }) {
  const failed = data.outcome === "fail" || data.outcome === "error";

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
        style={{ left: "50%" }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top-left"
        className="!w-2 !h-2 !bg-muted-foreground !border !border-background"
        style={{ left: "6px" }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top-right"
        className="!w-2 !h-2 !bg-muted-foreground !border !border-background"
        style={{ right: "6px", left: "auto" }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom-left"
        className="!w-2 !h-2 !bg-muted-foreground !border !border-background"
        style={{ left: "6px" }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom-right"
        className="!w-2 !h-2 !bg-muted-foreground !border !border-background"
        style={{ right: "6px", left: "auto" }}
      />

      <div className="flex items-center gap-2 mb-1">
        {data.isConditional ? (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            IF
          </span>
        ) : (
          <MethodBadge method={data.method} />
        )}
        {data.role && (
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded truncate max-w-[80px]",
              data.isLogin
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-secondary text-secondary-foreground"
            )}
          >
            {data.role}
          </span>
        )}
        {failed && (
          <div className="ml-auto">
            <StepErrorPopover data={data} />
          </div>
        )}
      </div>

      <p className="text-xs font-mono truncate">
        {data.isConditional ? data.label || "Conditional branch" : data.label}
      </p>

      {data.isConditional ? (
        <>
          <Handle
            type="source"
            position={Position.Top}
            id="source-top-left"
            className="!w-2 !h-2 !bg-primary !border !border-background"
            style={{ left: "6px" }}
          />
          <Handle
            type="source"
            position={Position.Top}
            id="source-top-right"
            className="!w-2 !h-2 !bg-primary !border !border-background"
            style={{ right: "6px", left: "auto" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!w-2.5 !h-2.5 !bg-green-600 !border-2 !border-background"
            style={{ left: "35%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-2.5 !h-2.5 !bg-red-600 !border-2 !border-background"
            style={{ left: "65%" }}
          />
        </>
      ) : (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="source"
            className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background"
            style={{ left: "50%" }}
          />
          <Handle
            type="source"
            position={Position.Top}
            id="source-top-left"
            className="!w-2 !h-2 !bg-primary !border !border-background"
            style={{ left: "6px" }}
          />
          <Handle
            type="source"
            position={Position.Top}
            id="source-top-right"
            className="!w-2 !h-2 !bg-primary !border !border-background"
            style={{ right: "6px", left: "auto" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="source-bottom-left"
            className="!w-2 !h-2 !bg-primary !border !border-background"
            style={{ left: "6px" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="source-bottom-right"
            className="!w-2 !h-2 !bg-primary !border !border-background"
            style={{ right: "6px", left: "auto" }}
          />
        </>
      )}
    </div>
  );
}

function SectionNode({ data }: { data: SectionNodeData }) {
  return (
    <div
      className={cn(
        "h-full w-full rounded-xl border border-dashed border-primary/30 bg-primary/5 p-2",
        data.selected && "ring-2 ring-primary/50 ring-offset-1 ring-offset-background"
      )}
    >
      <NodeResizer
        isVisible={data.selected}
        minWidth={260}
        minHeight={160}
        handleClassName="!h-2.5 !w-2.5 !border !border-background !bg-primary"
        lineClassName="!border-primary/50"
      />
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-primary/90">
        {data.title}
      </p>
    </div>
  );
}

const nodeTypes = { flowStep: memo(StepNode), flowSection: memo(SectionNode) };

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
  const sections = flow.sections ?? [];

  const sectionNodes: Node[] = sections
    .slice()
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((section) => ({
      id: section.id,
      type: "flowSection",
      position: section.position,
      width: section.width,
      height: section.height,
      data: {
        title: section.title,
        selected: selectedStepId === section.id,
      } satisfies SectionNodeData,
      style: {
        width: section.width,
        height: section.height,
      },
      selected: selectedStepId === section.id,
      draggable: true,
      selectable: true,
      connectable: false,
      zIndex: section.zIndex ?? -1,
      ariaRole: "region",
    }));

  const stepNodes: Node[] = flow.steps.map((step: FlowStep, index) => {
    const ep = endpoints.find((e) => flowEndpointKey(e) === step.endpointKey);
    const result = resultByStepId.get(step.id);
    const running = runningIndex === index;
    const { label: role, isLogin } = stepRoleLabel(step, flow.auth);
    const position = positions[step.id] ?? defaultDiagramPosition(index);

    return {
      id: step.id,
      type: "flowStep",
      position,
      width: DIAGRAM_NODE_W,
      data: {
        label: ep?.path ?? step.endpointKey,
        method:
          step.stepKind === "conditional" ? "IF" : ep?.method ?? "GET",
        role,
        isLogin,
        statusClass: statusColor(result?.outcome, running),
        selected: selectedStepId === step.id,
        isConditional: step.stepKind === "conditional",
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
      zIndex: 10,
    };
  });
  const nodes: Node[] = [...sectionNodes, ...stepNodes];

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
      sourceHandle:
        conn.sourceHandle ??
        (conn.kind === "true"
          ? "true"
          : conn.kind === "false"
            ? "false"
            : "source"),
      targetHandle: conn.targetHandle ?? "target",
      type: "smoothstep",
      animated: true,
      className: "flow-edge-seq",
      data: { kind: conn.kind ?? "seq" },
      deletable: true,
      reconnectable: true,
      label:
        conn.kind === "true"
          ? "true"
          : conn.kind === "false"
            ? "false"
            : undefined,
      labelStyle:
        conn.kind === "true" || conn.kind === "false"
          ? { fontSize: 10, fill: "var(--foreground)" }
          : undefined,
      labelBgStyle:
        conn.kind === "true" || conn.kind === "false"
          ? { fill: "var(--card)" }
          : undefined,
      labelBgPadding:
        conn.kind === "true" || conn.kind === "false"
          ? ([4, 2] as [number, number])
          : undefined,
      labelBgBorderRadius:
        conn.kind === "true" || conn.kind === "false" ? 4 : undefined,
      style: {
        stroke:
          conn.kind === "true"
            ? "var(--success)"
            : conn.kind === "false"
              ? "var(--destructive)"
              : seqStroke,
        strokeWidth: 2.2,
        opacity: 0.95,
      },
      interactionWidth: 24,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color:
          conn.kind === "true"
            ? "var(--success)"
            : conn.kind === "false"
              ? "var(--destructive)"
              : seqStroke,
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
      style: { stroke: depStroke, strokeWidth: 2.5, opacity: 0.9 },
      interactionWidth: 24,
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

type MenuKind = "node" | "section" | "edge" | "pane";

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
  const [announcement, setAnnouncement] = useState("");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const diagramRootRef = useRef<HTMLDivElement>(null);

  const ensureSelectionAfterRestore = useCallback(
    (restored: Flow) => {
      if (
        selectedStepId &&
        !restored.steps.some((s) => s.id === selectedStepId) &&
        !(restored.sections ?? []).some((s) => s.id === selectedStepId)
      ) {
        onSelectStep(null);
      }
    },
    [selectedStepId, onSelectStep]
  );

  const {
    commitDiagramChange,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDiagramHistory(flow, onChange, {
    onAfterRestore: ensureSelectionAfterRestore,
  });

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='combobox']"
        )
      ) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        if (canRedo) redo();
      } else if (canUndo) {
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, undo, redo, canUndo, canRedo]);

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

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      onNodesChangeBase(changes);
      const sections = flow.sections ?? [];
      if (sections.length === 0) return;
      let nextSections: FlowSection[] | null = null;
      for (const change of changes) {
        if (!("id" in change)) continue;
        if (!change.id.startsWith("section-")) continue;
        const idx = sections.findIndex((s) => s.id === change.id);
        if (idx < 0) continue;
        const current: FlowSection[] = [...(nextSections ?? sections)];
        const item = { ...current[idx] };
        if (change.type === "position" && change.position) {
          item.position = change.position;
        }
        if (change.type === "dimensions" && change.dimensions) {
          item.width = change.dimensions.width ?? item.width;
          item.height = change.dimensions.height ?? item.height;
        }
        current[idx] = item;
        nextSections = current;
      }
      if (nextSections) {
        commitDiagramChange({ ...flow, sections: nextSections });
      }
    },
    [onNodesChangeBase, flow, commitDiagramChange]
  );

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
      commitDiagramChange({
        ...flow,
        diagramPositions: {
          ...(flow.diagramPositions ?? {}),
          [id]: { x, y },
        },
      });
    },
    [flow, commitDiagramChange]
  );

  const upsertSection = useCallback(
    (sectionId: string, patch: Partial<FlowSection>) => {
      const sections = flow.sections ?? [];
      const next = sections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s
      );
      commitDiagramChange({ ...flow, sections: next });
    },
    [flow, commitDiagramChange]
  );

  const createSection = useCallback(() => {
    const idx = (flow.sections?.length ?? 0) + 1;
    const width = 520;
    const height = 220;
    const rootRect = diagramRootRef.current?.getBoundingClientRect();
    const viewportCenter = rootRect
      ? screenToFlowPosition({
          x: rootRect.left + rootRect.width / 2,
          y: rootRect.top + rootRect.height / 2,
        })
      : { x: 320 + idx * 24, y: 180 + idx * 20 };

    const section: FlowSection = {
      id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `Section ${idx}`,
      position: {
        x: Math.max(0, viewportCenter.x - width / 2),
        y: Math.max(0, viewportCenter.y - height / 2),
      },
      width,
      height,
      zIndex: idx,
      stepIds: [],
      semanticType: "group",
    };
    commitDiagramChange({ ...flow, sections: [...(flow.sections ?? []), section] });
    onSelectStep(section.id);
    requestAnimationFrame(() => {
      void fitView({
        duration: 220,
        padding: 0.2,
        nodes: [{ id: section.id }],
      });
      setCenter(
        section.position.x + section.width / 2,
        section.position.y + section.height / 2,
        { zoom: Math.max(zoom, 0.95), duration: 220 }
      );
    });
    setAnnouncement(
      `${section.title} added at viewport center and selected. Use resize handles to adjust.`
    );
  }, [
    flow,
    commitDiagramChange,
    onSelectStep,
    screenToFlowPosition,
    fitView,
    setCenter,
    zoom,
  ]);

  const deleteSection = useCallback(
    (sectionId: string) => {
      const sections = (flow.sections ?? []).filter((s) => s.id !== sectionId);
      commitDiagramChange({ ...flow, sections });
      if (selectedStepId === sectionId) onSelectStep(null);
      setAnnouncement("Section deleted");
    },
    [flow, commitDiagramChange, selectedStepId, onSelectStep]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const isSection = node.id.startsWith("section-");
      if (isSection) {
        upsertSection(node.id, {
          position: { x: node.position.x, y: node.position.y },
          width: node.width ?? 520,
          height: node.height ?? 220,
        });
        return;
      }
      persistPositions(node.id, node.position.x, node.position.y);
    },
    [persistPositions, upsertSection]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const base = flow.connections ?? linearConnections(flow.steps);
      const sourceStep = flow.steps.find((s) => s.id === conn.source);
      let kind: FlowConnection["kind"] = "seq";
      if (sourceStep?.stepKind === "conditional") {
        if (conn.sourceHandle === "true" || conn.sourceHandle === "false") {
          kind = conn.sourceHandle;
        }
        const outgoing = base.filter((c) => c.source === conn.source);
        if (kind === "seq") {
          const hasTrue = outgoing.some((c) => (c.kind ?? "seq") === "true");
          const hasFalse = outgoing.some((c) => (c.kind ?? "seq") === "false");
          kind = !hasTrue ? "true" : !hasFalse ? "false" : "seq";
        }
      }
      const nextConns = addConnection(base, conn.source, conn.target, kind);
      const next =
        nextConns === base
          ? base
          : nextConns.map((c) =>
              c.source === conn.source &&
              c.target === conn.target &&
              (c.kind ?? "seq") === (kind ?? "seq")
                ? {
                    ...c,
                    sourceHandle: conn.sourceHandle ?? c.sourceHandle,
                    targetHandle: conn.targetHandle ?? c.targetHandle,
                  }
                : c
            );
      if (nextConns === base) return;
      const reordered = reorderStepsByConnections({
        ...flow,
        connections: next,
      });
      commitDiagramChange({ ...flow, connections: next, steps: reordered });
    },
    [flow, commitDiagramChange]
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
      commitDiagramChange({ ...flow, steps, connections, diagramPositions: positions });
      if (selectedStepId && idSet.has(selectedStepId)) onSelectStep(null);
    },
    [flow, commitDiagramChange, selectedStepId, onSelectStep]
  );

  const deleteSeqEdges = useCallback(
    (deleted: Edge[]) => {
      const seq = deleted.filter((e) => (e.data as { kind?: string })?.kind === "seq");
      if (seq.length === 0) return;
      let conns = flow.connections ?? linearConnections(flow.steps);
      for (const e of seq) conns = removeConnection(conns, e.source, e.target);
      const reordered = reorderStepsByConnections({ ...flow, connections: conns });
      commitDiagramChange({ ...flow, connections: conns, steps: reordered });
    },
    [flow, commitDiagramChange]
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
        newConnection.target,
        "seq",
        newConnection.sourceHandle ?? undefined,
        newConnection.targetHandle ?? undefined
      );
      // addConnection returns the same array when the new edge is a duplicate or
      // would create a cycle; in that case keep the original wiring untouched.
      if (added === removed) return;
      const reordered = reorderStepsByConnections({
        ...flow,
        connections: added,
      });
      commitDiagramChange({ ...flow, connections: added, steps: reordered });
    },
    [flow, commitDiagramChange]
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
      commitDiagramChange({
        ...flow,
        steps: [...flow.steps, step],
        diagramPositions: {
          ...(flow.diagramPositions ?? {}),
          [step.id]: position,
        },
      });
      onSelectStep(step.id);
      setAnnouncement(`Added step ${endpoint.method} ${endpoint.path}`);
    },
    [
      flow,
      endpoints,
      apiData,
      baseUrl,
      screenToFlowPosition,
      commitDiagramChange,
      onSelectStep,
    ]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const autoArrange = useCallback(async () => {
    const stepIds = flow.steps.map((s) => s.id);
    try {
      const positions = await layoutWithElk(stepIds, effectiveConnections(flow));
      commitDiagramChange({ ...flow, diagramPositions: positions });
      setAnnouncement("Auto-arranged steps horizontally");
      requestAnimationFrame(() => void fitView({ padding: 0.25, duration: 200 }));
    } catch {
      const ordered = orderSteps(flow);
      const positions: Record<string, { x: number; y: number }> = {};
      ordered.forEach((s, i) => {
        positions[s.id] = defaultDiagramPosition(i);
      });
      commitDiagramChange({ ...flow, diagramPositions: positions });
      setAnnouncement("Auto-arranged steps horizontally");
      requestAnimationFrame(() => void fitView({ padding: 0.25, duration: 200 }));
    }
  }, [flow, commitDiagramChange, fitView]);

  const deleteSelected = useCallback(() => {
    const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
    const sectionIds = selectedNodeIds.filter((id) => id.startsWith("section-"));
    const stepIds = selectedNodeIds.filter((id) => !id.startsWith("section-"));
    if (sectionIds.length > 0) {
      const remaining = (flow.sections ?? []).filter((s) => !sectionIds.includes(s.id));
      commitDiagramChange({ ...flow, sections: remaining });
      setAnnouncement("Deleted selected section");
      if (selectedStepId && sectionIds.includes(selectedStepId)) onSelectStep(null);
      return;
    }
    if (stepIds.length > 0) {
      deleteSteps(stepIds);
      setAnnouncement("Deleted selected step");
      return;
    }
    const selectedEdges = edges.filter((e) => e.selected);
    if (selectedEdges.length > 0) {
      deleteSeqEdges(selectedEdges);
      setAnnouncement("Deleted selected connection");
    }
  }, [
    nodes,
    edges,
    deleteSteps,
    deleteSeqEdges,
    flow,
    commitDiagramChange,
    selectedStepId,
    onSelectStep,
  ]);

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
      commitDiagramChange({
        ...flow,
        steps: [...flow.steps, copy],
        diagramPositions: {
          ...(flow.diagramPositions ?? {}),
          [copy.id]: { x: pos.x + 40, y: pos.y + 40 },
        },
      });
      onSelectStep(copy.id);
    },
    [flow, commitDiagramChange, onSelectStep]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectStep(node.id);
      if (node.id.startsWith("section-")) {
        setAnnouncement("Section selected");
      } else {
        setAnnouncement("Step selected");
      }
    },
    [onSelectStep]
  );

  const onPaneClick = useCallback(() => {
    onSelectStep(null);
    setAnnouncement("Selection cleared");
  }, [onSelectStep]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      kind: node.id.startsWith("section-") ? "section" : "node",
      targetId: node.id,
    });
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
          label: "Use as login for flow",
          icon: <KeyRound className="h-3.5 w-3.5" />,
          onClick: () => {
            commitDiagramChange(setFlowLoginStep(flow, targetId));
            toast.success("This step is now the flow login");
          },
        },
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
    if (menu.kind === "section" && menu.targetId) {
      const targetId = menu.targetId;
      return [
        {
          label: "Rename section",
          icon: <Wand2 className="h-3.5 w-3.5" />,
          onClick: () => {
            const current = (flow.sections ?? []).find((s) => s.id === targetId);
            if (!current) return;
            const next = prompt("Section title", current.title)?.trim();
            if (!next) return;
            upsertSection(targetId, { title: next });
            setAnnouncement(`Renamed section to ${next}`);
          },
        },
        {
          label: "Delete section",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => deleteSection(targetId),
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
        label: "Add section",
        icon: <Plus className="h-3.5 w-3.5" />,
        onClick: createSection,
      },
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
    flow,
    commitDiagramChange,
    createSection,
    upsertSection,
    deleteSection,
  ]);

  return (
    <div ref={diagramRootRef} className="relative h-full w-full outline-none">
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
          nodesFocusable
          edgesFocusable
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
              <ToolbarButton label="Add section" onClick={createSection}>
                <Copy className="h-4 w-4" />
              </ToolbarButton>
              <FlowAuthPopover
                flow={flow}
                endpoints={endpoints}
                credentials={credentials}
                onChange={commitDiagramChange}
              />
              <Separator />
              <ToolbarButton
                label="Undo (Ctrl+Z)"
                onClick={undo}
                disabled={!canUndo}
              >
                <Undo2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Redo (Ctrl+Shift+Z)"
                onClick={redo}
                disabled={!canRedo}
              >
                <Redo2 className="h-4 w-4" />
              </ToolbarButton>
              <Separator />
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

      <FlowStepInspector
        flow={flow}
        endpoints={endpoints}
        apiData={apiData}
        baseUrl={baseUrl}
        credentials={credentials}
        selectedStepId={selectedStepId}
        resultByStepId={resultByStepId}
        runningIndex={runningIndex}
        onChange={commitDiagramChange}
        onClose={() => onSelectStep(null)}
        onRunFromStep={onRunFromStep}
      />

      <CanvasContextMenu
        state={menu}
        items={menuItems}
        onClose={() => setMenu(null)}
      />
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

function FlowAuthPopover({
  flow,
  endpoints,
  credentials,
  onChange,
}: {
  flow: Flow;
  endpoints: PlaygroundEndpoint[];
  credentials: Credential[];
  onChange: (flow: Flow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [bulkRunAs, setBulkRunAs] = useState<RunAsBulkValue>("__default__");
  const ordered = useMemo(() => orderSteps(flow), [flow]);

  const applyBulk = () => {
    onChange(applyRunAsToAll(flow, bulkRunAs));
    toast.success("Run-as applied to all steps");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={flow.auth ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          title="Flow auth"
        >
          <KeyRound className="h-4 w-4" />
          <span className="sr-only">Flow auth</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="center">
        <p className="text-xs font-semibold mb-1">Flow auth</p>
        <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
          Mark a login step and capture its token. Other steps on Flow default
          automatically send Bearer token—no pause or per-step header edits.
        </p>

        <div className="space-y-1.5 mb-3">
          <Label className="text-[10px]">Login step</Label>
          <Select
            value={flow.auth?.loginStepId ?? "__none__"}
            onValueChange={(v) => {
              if (v === "__none__") {
                onChange({ ...flow, auth: undefined });
                toast.success("Login step cleared");
                return;
              }
              onChange(setFlowLoginStep(flow, v));
              toast.success("Login step set");
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choose login step" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {ordered.map((s, i) => {
                const ep = endpoints.find(
                  (e) => flowEndpointKey(e) === s.endpointKey
                );
                return (
                  <SelectItem key={s.id} value={s.id}>
                    Step {i + 1}: {ep?.method ?? ""} {ep?.path ?? s.endpointKey}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {flow.auth?.tokenVar && (
            <p className="text-[10px] text-muted-foreground">
              Token variable:{" "}
              <code className="font-mono">{flow.auth.tokenVar}</code>
            </p>
          )}
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <Label className="text-[10px]">Apply Run as to all steps</Label>
          <Select
            value={bulkRunAs}
            onValueChange={(v) => setBulkRunAs(v as RunAsBulkValue)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                Flow default (inherit login token)
              </SelectItem>
              <SelectItem value="__none__">No auth</SelectItem>
              {credentials.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={applyBulk}
          >
            Apply to all steps
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Separator() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
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
          aria-label={label}
          disabled={disabled}
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

export function FlowDiagram(props: FlowDiagramProps) {
  return (
    <div className="flow-diagram flex h-full min-h-[400px] w-full flex-col">
      <ReactFlowProvider>
        <FlowCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
