/**
 * Graph auto-layout for the flow canvas using elkjs (layered algorithm). Handles
 * branching DAGs (multiple roots/parents) that a naive vertical stack cannot.
 */
import ELK from "elkjs/lib/elk.bundled.js";
import {
  DIAGRAM_NODE_H,
  DIAGRAM_NODE_W,
  type DiagramPosition,
} from "@/lib/flows/types";

export type LayoutEdge = { source: string; target: string };

const elk = new ELK();

export async function layoutWithElk(
  nodeIds: string[],
  edges: LayoutEdge[],
  direction: "DOWN" | "RIGHT" = "DOWN"
): Promise<Record<string, DiagramPosition>> {
  if (nodeIds.length === 0) return {};

  const nodeSet = new Set(nodeIds);
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.spacing.nodeNode": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: nodeIds.map((id) => ({
      id,
      width: DIAGRAM_NODE_W,
      height: DIAGRAM_NODE_H,
    })),
    edges: edges
      .filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
      .map((e, i) => ({
        id: `elk-edge-${i}`,
        sources: [e.source],
        targets: [e.target],
      })),
  };

  const result = await elk.layout(graph);
  const positions: Record<string, DiagramPosition> = {};
  for (const child of result.children ?? []) {
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  }
  return positions;
}
