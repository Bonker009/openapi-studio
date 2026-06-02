"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlaygroundHeader } from "@/components/playground/playground-header";
import { EndpointList } from "@/components/playground/endpoint-list";
import { TryItPanel } from "@/components/playground/try-it-panel";
import {
  extractPlaygroundEndpoints,
  type EndpointAuthRole,
  type PlaygroundEndpoint,
} from "@/lib/playground/endpoints";
import {
  getEndpointAuthRoleOverrides,
  withEndpointAuthRoles,
} from "@/lib/playground/endpoint-auth-roles";
import {
  credentialRequiresAuth,
  type Credential,
} from "@/lib/playground/credentials";
import { cn } from "@/lib/utils";

type PlaygroundShellProps = {
  specId: string;
  specTitle: string;
  specVersion?: string;
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
    servers?: { url: string; description?: string }[];
    security?: unknown[];
  };
  workingPaths?: Set<string>;
};

const LEFT_WIDTH_STORAGE_KEY = "playground_main_left_panel_width";
const LEFT_WIDTH_DEFAULT = 480;
const LEFT_WIDTH_MIN = 280;
const RIGHT_WIDTH_MIN = 360;
const LEFT_WIDTH_MAX_RATIO = 0.7;
const RESIZE_STEP_PX = 12;
const LG_BREAKPOINT_PX = 1024;

function loadLeftPanelWidth(): number {
  if (typeof window === "undefined") return LEFT_WIDTH_DEFAULT;
  try {
    const raw = localStorage.getItem(LEFT_WIDTH_STORAGE_KEY);
    if (!raw) return LEFT_WIDTH_DEFAULT;
    const w = Number(raw);
    if (!Number.isFinite(w)) return LEFT_WIDTH_DEFAULT;
    return Math.max(LEFT_WIDTH_MIN, w);
  } catch {
    return LEFT_WIDTH_DEFAULT;
  }
}

function saveLeftPanelWidth(width: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    /* quota */
  }
}

function clampLeftWidth(width: number, containerWidth: number): number {
  if (containerWidth <= 0) {
    return Math.max(LEFT_WIDTH_MIN, width);
  }
  const maxByRatio = containerWidth * LEFT_WIDTH_MAX_RATIO;
  const maxByRight = containerWidth - RIGHT_WIDTH_MIN - 12;
  const max = Math.max(
    LEFT_WIDTH_MIN,
    Math.min(maxByRatio, maxByRight > LEFT_WIDTH_MIN ? maxByRight : maxByRatio)
  );
  return Math.min(max, Math.max(LEFT_WIDTH_MIN, width));
}

export function PlaygroundShell({
  specId,
  specTitle,
  specVersion,
  apiData,
  workingPaths,
}: PlaygroundShellProps) {
  const [baseUrl, setBaseUrl] = useState(
    apiData.servers?.[0]?.url?.replace(/\/$/, "") ?? "http://localhost:8080"
  );
  const [selected, setSelected] = useState<PlaygroundEndpoint | null>(null);
  const [activeCredential, setActiveCredential] = useState<Credential | null>(
    null
  );
  const [authRoleOverrides, setAuthRoleOverrides] = useState<
    Record<string, EndpointAuthRole>
  >(() =>
    typeof window !== "undefined" ? getEndpointAuthRoleOverrides(specId) : {}
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState(() =>
    loadLeftPanelWidth()
  );
  const [splitContainerWidth, setSplitContainerWidth] = useState(0);
  const splitRef = useRef<HTMLDivElement>(null);
  const saveWidthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const isSplitResizable =
    splitContainerWidth >= LG_BREAKPOINT_PX && splitContainerWidth > 0;

  useEffect(() => {
    setAuthRoleOverrides(getEndpointAuthRoleOverrides(specId));
  }, [specId]);

  const endpoints = useMemo(
    () =>
      withEndpointAuthRoles(
        extractPlaygroundEndpoints({
          paths: apiData.paths as
            | Record<string, Record<string, unknown>>
            | undefined,
          security: apiData.security,
        }),
        authRoleOverrides
      ),
    [apiData.paths, apiData.security, authRoleOverrides]
  );

  useEffect(() => {
    if (endpoints.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((prev) => {
      if (!prev) return endpoints[0];
      const match = endpoints.find(
        (e) => e.method === prev.method && e.path === prev.path
      );
      return match ?? endpoints[0];
    });
  }, [endpoints]);

  useEffect(() => {
    const el = splitRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setSplitContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isSplitResizable) return;
    setLeftPanelWidth((prev) => clampLeftWidth(prev, splitContainerWidth));
  }, [splitContainerWidth, isSplitResizable]);

  const scheduleSaveWidth = useCallback((width: number) => {
    if (saveWidthTimerRef.current) clearTimeout(saveWidthTimerRef.current);
    saveWidthTimerRef.current = setTimeout(() => {
      saveLeftPanelWidth(width);
    }, 200);
  }, []);

  const setLeftWidthClamped = useCallback(
    (next: number) => {
      const clamped = clampLeftWidth(next, splitContainerWidth);
      setLeftPanelWidth(clamped);
      scheduleSaveWidth(clamped);
    },
    [splitContainerWidth, scheduleSaveWidth]
  );

  const onSplitResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isSplitResizable) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: leftPanelWidth };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        setLeftWidthClamped(dragRef.current.startWidth + delta);
      };

      const onUp = (ev: PointerEvent) => {
        dragRef.current = null;
        target.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [leftPanelWidth, isSplitResizable, setLeftWidthClamped]
  );

  const onSplitResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isSplitResizable) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLeftWidthClamped(leftPanelWidth - RESIZE_STEP_PX);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setLeftWidthClamped(leftPanelWidth + RESIZE_STEP_PX);
      } else if (e.key === "Home" || e.key === "Enter") {
        e.preventDefault();
        setLeftWidthClamped(LEFT_WIDTH_DEFAULT);
      } else if (e.key === "End") {
        e.preventDefault();
        setLeftWidthClamped(
          clampLeftWidth(splitContainerWidth, splitContainerWidth)
        );
      }
    },
    [leftPanelWidth, isSplitResizable, setLeftWidthClamped, splitContainerWidth]
  );

  const selectFirst = () => {
    const first = endpoints[0];
    if (first) setSelected(first);
  };

  const authSatisfied = credentialRequiresAuth(activeCredential);

  const leftMax = clampLeftWidth(splitContainerWidth, splitContainerWidth);

  return (
    <>
      <PlaygroundHeader
        specId={specId}
        specTitle={specTitle}
        specVersion={specVersion}
        specServers={apiData.servers}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        activeCredential={activeCredential}
        onActiveCredentialChange={setActiveCredential}
        endpoints={endpoints}
        apiData={apiData}
        workingPaths={workingPaths}
      />

      <main
        id="main-content"
        ref={splitRef}
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        <div
          className={cn(
            "min-w-0 shrink-0 border-r border-border bg-card flex flex-col min-h-0",
            !isSplitResizable && "w-1/2"
          )}
          style={
            isSplitResizable
              ? { width: leftPanelWidth, maxWidth: "100%" }
              : undefined
          }
        >
          <EndpointList
            specId={specId}
            endpoints={endpoints}
            selected={selected}
            onSelect={setSelected}
            authSatisfied={authSatisfied}
            authRoleOverrides={authRoleOverrides}
            onAuthRoleOverridesChange={setAuthRoleOverrides}
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(leftPanelWidth)}
          aria-valuemin={LEFT_WIDTH_MIN}
          aria-valuemax={Math.round(leftMax)}
          aria-label="Resize endpoint list panel"
          tabIndex={isSplitResizable ? 0 : -1}
          className={cn(
            "group shrink-0 w-2 touch-none cursor-col-resize items-center justify-center",
            "bg-border/40 hover:bg-primary/25 focus-visible:bg-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
            isSplitResizable ? "flex" : "hidden"
          )}
          onPointerDown={onSplitResizePointerDown}
          onKeyDown={onSplitResizeKeyDown}
        >
          <div
            className="w-0.5 h-10 rounded-full bg-border/80 group-hover:bg-primary/60 group-focus-visible:bg-primary/70"
            aria-hidden
          />
        </div>

        <div className="flex-1 min-w-0 min-h-0 overflow-hidden bg-card flex flex-col">
          <TryItPanel
            specId={specId}
            endpoint={selected}
            apiData={apiData}
            baseUrl={baseUrl}
            activeCredential={activeCredential}
            onActiveCredentialChange={setActiveCredential}
            totalEndpoints={endpoints.length}
            onSelectFirst={selectFirst}
          />
        </div>
      </main>
    </>
  );
}
