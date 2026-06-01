"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Flow } from "@/domain/flows/types";

export const DIAGRAM_HISTORY_MAX = 50;

/** Fields owned by the diagram surface (undo/redo scope). */
export function diagramSnapshot(flow: Flow): string {
  return JSON.stringify({
    steps: flow.steps,
    connections: flow.connections ?? null,
    diagramPositions: flow.diagramPositions ?? null,
    auth: flow.auth ?? null,
  });
}

function cloneFlow(flow: Flow): Flow {
  return structuredClone(flow);
}

export function useDiagramHistory(
  flow: Flow,
  onChange: (flow: Flow) => void,
  options?: { onAfterRestore?: (flow: Flow) => void }
) {
  const [past, setPast] = useState<Flow[]>([]);
  const [future, setFuture] = useState<Flow[]>([]);
  const actionRef = useRef<"commit" | "undo" | "redo" | null>(null);
  const lastSnapshotRef = useRef(diagramSnapshot(flow));

  useEffect(() => {
    if (actionRef.current) {
      actionRef.current = null;
      lastSnapshotRef.current = diagramSnapshot(flow);
      return;
    }
    const snap = diagramSnapshot(flow);
    if (snap === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snap;
    setPast([]);
    setFuture([]);
  }, [flow]);

  const commitDiagramChange = useCallback(
    (next: Flow) => {
      const before = diagramSnapshot(flow);
      const after = diagramSnapshot(next);
      if (before === after) return;

      setPast((p) => [...p, cloneFlow(flow)].slice(-DIAGRAM_HISTORY_MAX));
      setFuture([]);
      actionRef.current = "commit";
      lastSnapshotRef.current = after;
      onChange(next);
    },
    [flow, onChange]
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1]!;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [cloneFlow(flow), ...f].slice(0, DIAGRAM_HISTORY_MAX));
    actionRef.current = "undo";
    lastSnapshotRef.current = diagramSnapshot(previous);
    onChange(previous);
    options?.onAfterRestore?.(previous);
  }, [past, flow, onChange, options]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0]!;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, cloneFlow(flow)].slice(-DIAGRAM_HISTORY_MAX));
    actionRef.current = "redo";
    lastSnapshotRef.current = diagramSnapshot(next);
    onChange(next);
    options?.onAfterRestore?.(next);
  }, [future, flow, onChange, options]);

  return {
    commitDiagramChange,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
