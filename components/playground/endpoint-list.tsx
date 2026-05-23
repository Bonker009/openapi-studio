"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MethodBadge } from "@/components/method-badge";
import {
  groupEndpointsByController,
  type PlaygroundEndpoint,
} from "@/lib/playground/endpoints";
import { cn } from "@/lib/utils";

type EndpointListProps = {
  endpoints: PlaygroundEndpoint[];
  selected: PlaygroundEndpoint | null;
  onSelect: (endpoint: PlaygroundEndpoint) => void;
};

export function EndpointList({
  endpoints,
  selected,
  onSelect,
}: EndpointListProps) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col h-full min-h-0">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Label htmlFor="endpoint-list-search" className="sr-only">
            Filter endpoints
          </Label>
          <Input
            id="endpoint-list-search"
            ref={searchRef}
            placeholder="Filter by tag, path, or summary… (/ to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <h2 className="sr-only">Endpoints</h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center px-4">
            No endpoints match your filter
          </p>
        ) : (
          controllers.map((controller) => (
            <section
              key={controller}
              className="border-b border-border last:border-b-0"
            >
              <h3 className="sticky top-0 z-[1] bg-muted/50 backdrop-blur-sm px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
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
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => onSelect(ep)}
                        aria-current={isSelected ? "true" : undefined}
                        aria-label={`${ep.method} ${ep.path}${ep.requiresAuth ? ", requires authentication" : ""}`}
                        className={cn(
                          "w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors rounded-none border-l-2 border-transparent",
                          isSelected
                            ? "bg-primary/10 border-l-primary"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <MethodBadge
                          method={ep.method}
                          className="shrink-0 mt-0.5 text-[10px] px-1.5 py-0 min-w-13 justify-center"
                        />
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <span className="font-mono text-sm text-foreground break-all leading-snug">
                            {ep.path}
                          </span>
                          {(ep.summary || ep.description) && (
                            <span className="text-xs text-muted-foreground leading-snug">
                              {ep.summary ?? ep.description}
                            </span>
                          )}
                        </div>
                        {ep.requiresAuth && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="shrink-0 inline-flex">
                                <Lock
                                  className="h-3.5 w-3.5 text-muted-foreground"
                                  aria-hidden
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              Requires authentication
                            </TooltipContent>
                          </Tooltip>
                        )}
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
