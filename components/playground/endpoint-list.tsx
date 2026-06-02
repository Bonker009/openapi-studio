"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Lock, LockOpen, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  setEndpointAuthRoleOverride,
} from "@/lib/playground/endpoint-auth-roles";
import {
  groupEndpointsByController,
  type EndpointAuthRole,
  type PlaygroundEndpoint,
} from "@/lib/playground/endpoints";
import { endpointKey } from "@/shared/utils/endpoint-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MethodBadge } from "@/components/method-badge";
import { cn } from "@/lib/utils";

const METHOD_MIN = 56;
const METHOD_DEFAULT = 76;
const METHOD_MAX = 160;
const AUTH_COL_WIDTH = 28;
const COMPACT_BREAKPOINT = 320;

function colStorageKey(specId: string) {
  return `playground_endpoint_cols_${specId}`;
}

function loadMethodWidth(specId: string): number {
  if (typeof window === "undefined") return METHOD_DEFAULT;
  try {
    const raw = localStorage.getItem(colStorageKey(specId));
    if (!raw) return METHOD_DEFAULT;
    const parsed = JSON.parse(raw) as { method?: number };
    const w = Number(parsed.method);
    if (!Number.isFinite(w)) return METHOD_DEFAULT;
    return Math.min(METHOD_MAX, Math.max(METHOD_MIN, w));
  } catch {
    return METHOD_DEFAULT;
  }
}

function saveMethodWidth(specId: string, method: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      colStorageKey(specId),
      JSON.stringify({ method })
    );
  } catch {
    /* quota */
  }
}

const AUTH_ROLE_OPTIONS: {
  value: EndpointAuthRole | "auto";
  label: string;
}[] = [
  { value: "auto", label: "Auto (from spec)" },
  { value: "none", label: "None" },
  { value: "login", label: "Login" },
  { value: "refresh", label: "Refresh" },
  { value: "protected", label: "Protected" },
];

function EndpointAuthRoleControl({
  specId,
  endpoint,
  authRoleOverrides,
  onAuthRoleOverridesChange,
  authSatisfied,
}: {
  specId: string;
  endpoint: PlaygroundEndpoint;
  authRoleOverrides: Record<string, EndpointAuthRole>;
  onAuthRoleOverridesChange: (next: Record<string, EndpointAuthRole>) => void;
  authSatisfied: boolean;
}) {
  const key = endpointKey(endpoint.method, endpoint.path);
  const override = authRoleOverrides[key];
  const role = endpoint.authRole ?? "none";
  const defaultRole: EndpointAuthRole = endpoint.requiresAuth
    ? "protected"
    : "none";

  const pickRole = (value: EndpointAuthRole | "auto") => {
    const next = setEndpointAuthRoleOverride(
      specId,
      key,
      value === "auto" ? null : value
    );
    onAuthRoleOverridesChange(next);
  };

  const RoleIcon =
    role === "login"
      ? KeyRound
      : role === "refresh"
        ? RefreshCw
        : role === "protected"
          ? authSatisfied
            ? LockOpen
            : Lock
          : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label={`Auth role: ${role}${override ? " (override)" : ""}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {RoleIcon ? (
            <RoleIcon
              className={cn(
                "h-3.5 w-3.5",
                role === "protected" && authSatisfied && "text-success",
                role === "protected" && !authSatisfied && "text-muted-foreground",
                (role === "login" || role === "refresh") && "text-primary"
              )}
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs">Auth role</DropdownMenuLabel>
        {AUTH_ROLE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            className="text-xs"
            onClick={(e) => {
              e.stopPropagation();
              pickRole(opt.value);
            }}
          >
            {opt.label}
            {opt.value === "auto"
              ? !override
                ? " ✓"
                : ""
              : (override ?? defaultRole) === opt.value
                ? " ✓"
                : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type EndpointListProps = {
  specId: string;
  endpoints: PlaygroundEndpoint[];
  selected: PlaygroundEndpoint | null;
  onSelect: (endpoint: PlaygroundEndpoint) => void;
  authSatisfied: boolean;
  authRoleOverrides: Record<string, EndpointAuthRole>;
  onAuthRoleOverridesChange: (next: Record<string, EndpointAuthRole>) => void;
};

export function EndpointList({
  specId,
  endpoints,
  selected,
  onSelect,
  authSatisfied,
  authRoleOverrides,
  onAuthRoleOverridesChange,
}: EndpointListProps) {
  const [search, setSearch] = useState("");
  const [methodWidth, setMethodWidth] = useState(() =>
    loadMethodWidth(specId)
  );
  const [containerWidth, setContainerWidth] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const isCompact = containerWidth > 0 && containerWidth < COMPACT_BREAKPOINT;

  const gridColumns = useMemo(() => {
    if (isCompact) return undefined;
    return `${methodWidth}px minmax(140px, 1fr) ${AUTH_COL_WIDTH}px`;
  }, [isCompact, methodWidth]);

  useEffect(() => {
    setMethodWidth(loadMethodWidth(specId));
  }, [specId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scheduleSave = useCallback(
    (width: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveMethodWidth(specId, width);
      }, 200);
    },
    [specId]
  );

  const setMethodWidthClamped = useCallback(
    (next: number) => {
      const clamped = Math.min(METHOD_MAX, Math.max(METHOD_MIN, next));
      setMethodWidth(clamped);
      scheduleSave(clamped);
    },
    [scheduleSave]
  );

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isCompact) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: methodWidth };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        setMethodWidthClamped(dragRef.current.startWidth + delta);
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
    [isCompact, methodWidth, setMethodWidthClamped]
  );

  const onResizeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isCompact) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setMethodWidthClamped(methodWidth - 8);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setMethodWidthClamped(methodWidth + 8);
      } else if (e.key === "Home") {
        e.preventDefault();
        setMethodWidthClamped(METHOD_DEFAULT);
      } else if (e.key === "End") {
        e.preventDefault();
        setMethodWidthClamped(METHOD_MAX);
      }
    },
    [isCompact, methodWidth, setMethodWidthClamped]
  );

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

  const controllers = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Label htmlFor="endpoint-list-search" className="sr-only">
            Filter endpoints
          </Label>
          <Input
            id="endpoint-list-search"
            ref={searchRef}
            placeholder="Filter by tag, path, or summary… (/ to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="sr-only">Endpoints</h2>

        {!isCompact && filtered.length > 0 && (
          <div
            className="sticky top-0 z-2 grid items-center border-b border-border bg-muted/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm"
            style={{ gridTemplateColumns: gridColumns }}
          >
            <span>Method</span>
            <div className="relative flex min-w-0 items-center pr-1">
              <span className="min-w-0 flex-1 truncate">Path</span>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={methodWidth}
                aria-valuemin={METHOD_MIN}
                aria-valuemax={METHOD_MAX}
                aria-label="Resize method column"
                tabIndex={0}
                className="absolute -right-2 top-0 bottom-0 z-10 w-1 cursor-col-resize touch-none bg-transparent hover:bg-primary/40 focus-visible:bg-primary/50 focus-visible:outline-none"
                onPointerDown={onResizePointerDown}
                onKeyDown={onResizeKeyDown}
              />
            </div>
            <span className="sr-only">Auth</span>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No endpoints match your filter
          </p>
        ) : (
          controllers.map((controller) => (
            <section
              key={controller}
              className="border-b border-border last:border-b-0"
            >
              <h3 className="sticky top-0 z-1 border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                {controller}
                <span className="ml-2 font-normal tabular-nums text-muted-foreground/80">
                  ({grouped[controller].length})
                </span>
              </h3>
              <ul>
                {grouped[controller].map((ep) => {
                  const key = `${ep.method}:${ep.path}`;
                  const isSelected =
                    selected?.method === ep.method &&
                    selected?.path === ep.path;
                  const authLabel = ep.requiresAuth
                    ? authSatisfied
                      ? ", authentication applied"
                      : ", requires authentication"
                    : "";

                  if (isCompact) {
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => onSelect(ep)}
                          aria-current={isSelected ? "true" : undefined}
                          aria-label={`${ep.method} ${ep.path}${authLabel}`}
                          className={cn(
                            "w-full border-l-2 border-transparent px-4 py-2.5 text-left transition-colors",
                            isSelected
                              ? "border-l-primary bg-primary/10"
                              : "hover:bg-muted/40"
                          )}
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            <MethodBadge
                              method={ep.method}
                              className="mt-0.5 shrink-0 justify-center px-1.5 py-0 text-[10px] min-w-13"
                            />
                            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                              <span className="break-all font-mono text-sm leading-snug text-foreground">
                                {ep.path}
                              </span>
                              {(ep.summary || ep.description) && (
                                <span className="text-xs leading-snug text-muted-foreground">
                                  {ep.summary ?? ep.description}
                                </span>
                              )}
                            </div>
                            <EndpointAuthRoleControl
                              specId={specId}
                              endpoint={ep}
                              authRoleOverrides={authRoleOverrides}
                              onAuthRoleOverridesChange={
                                onAuthRoleOverridesChange
                              }
                              authSatisfied={authSatisfied}
                            />
                          </div>
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => onSelect(ep)}
                        aria-current={isSelected ? "true" : undefined}
                        aria-label={`${ep.method} ${ep.path}${authLabel}`}
                        className={cn(
                          "grid w-full items-start gap-x-2 border-l-2 border-transparent px-4 py-2 text-left transition-colors",
                          isSelected
                            ? "border-l-primary bg-primary/10"
                            : "hover:bg-muted/40"
                        )}
                        style={{ gridTemplateColumns: gridColumns }}
                      >
                        <MethodBadge
                          method={ep.method}
                          className="mt-0.5 shrink-0 justify-center px-1.5 py-0 text-[10px] min-w-0"
                        />
                        <div className="min-w-0 flex flex-col gap-0.5 py-0.5">
                          <span className="break-all font-mono text-sm leading-snug text-foreground">
                            {ep.path}
                          </span>
                          {(ep.summary || ep.description) && (
                            <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                              {ep.summary ?? ep.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-center pt-0.5">
                          <EndpointAuthRoleControl
                            specId={specId}
                            endpoint={ep}
                            authRoleOverrides={authRoleOverrides}
                            onAuthRoleOverridesChange={
                              onAuthRoleOverridesChange
                            }
                            authSatisfied={authSatisfied}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
