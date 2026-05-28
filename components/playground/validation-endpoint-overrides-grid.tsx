"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, LockOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MethodBadge } from "@/components/method-badge";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { endpointKey } from "@/lib/validation/types";
import type { ValidationOverridesStore } from "@/lib/validation/types";
import { countOverridesForEndpoint } from "@/lib/validation/overrides";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 100;

function EndpointAuthIcon({
  requiresAuth,
  authSatisfied,
}: {
  requiresAuth: boolean;
  authSatisfied: boolean;
}) {
  if (!requiresAuth) return null;
  const Icon = authSatisfied ? LockOpen : Lock;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 items-center justify-center">
          <Icon
            className={cn(
              "size-3.5",
              authSatisfied ? "text-success" : "text-muted-foreground"
            )}
            aria-hidden
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {authSatisfied
          ? "Authentication applied"
          : "Requires authentication — set token in playground"}
      </TooltipContent>
    </Tooltip>
  );
}

type ValidationEndpointOverridesGridProps = {
  endpoints: PlaygroundEndpoint[];
  store: ValidationOverridesStore;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  authSatisfied: boolean;
  disabled?: boolean;
};

export function ValidationEndpointOverridesGrid({
  endpoints,
  store,
  selectedKey,
  onSelect,
  authSatisfied,
  disabled,
}: ValidationEndpointOverridesGridProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    if (!deferredQuery) return endpoints;
    return endpoints.filter((ep) => {
      const haystack = [
        ep.method,
        ep.path,
        ep.controller,
        ep.summary ?? "",
        ep.operationId ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [endpoints, deferredQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const safePage = Math.min(page, pageCount - 1);

  const paginated = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const overrideCountByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const ep of endpoints) {
      const key = endpointKey(ep);
      map.set(key, countOverridesForEndpoint(store, key));
    }
    return map;
  }, [endpoints, store]);

  return (
    <div className="flex flex-col min-h-0 gap-3">
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search method, path, tag…"
          value={query}
          disabled={disabled}
          className="h-8 pl-8 text-xs"
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} endpoint{filtered.length === 1 ? "" : "s"}
        {deferredQuery ? ` matching "${query.trim()}"` : ""}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 min-h-[200px] max-h-[min(50vh,420px)] overflow-y-auto content-start">
        {paginated.map((ep) => {
          const key = endpointKey(ep);
          const selected = key === selectedKey;
          const count = overrideCountByKey.get(key) ?? 0;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(key)}
              className={cn(
                "flex flex-col gap-1 rounded-md border border-l-[3px] p-2 text-left text-xs transition-colors",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-l-primary border-primary/40 bg-primary/10 shadow-sm"
                  : "border-l-transparent"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MethodBadge method={ep.method} className="shrink-0 text-[10px]" />
                <span className="truncate font-mono flex-1">{ep.path}</span>
                <EndpointAuthIcon
                  requiresAuth={ep.requiresAuth}
                  authSatisfied={authSatisfied}
                />
                {count > 0 ? (
                  <Badge variant="secondary" className="shrink-0 tabular-nums text-[10px]">
                    {count}
                  </Badge>
                ) : null}
              </div>
              <span className="text-[10px] text-muted-foreground truncate">
                {ep.controller}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No endpoints match your search.
        </p>
      ) : null}

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="size-3.5 mr-1" aria-hidden />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled || safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
            <ChevronRight className="size-3.5 ml-1" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
