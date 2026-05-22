"use client";

import { useEffect, useState } from "react";
import { Globe, Plus } from "lucide-react";
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
  dedupeEnvironmentsByUrl,
  mergeSpecAndCustomEnvironments,
  resolveActiveEnvironment,
  serversToEnvironments,
} from "@/lib/playground/environments";
import {
  getActiveEnvironment,
  getEnvironments,
  setActiveEnvironment,
  setEnvironments,
  type PlaygroundEnvironment,
} from "@/lib/playground/storage";
type EnvironmentSwitcherProps = {
  specId: string;
  specServers?: { url: string; description?: string }[];
  activeUrl: string;
  onActiveUrlChange: (url: string) => void;
  variant?: "sidebar" | "navbar";
};

function ensureCustomIds(custom: PlaygroundEnvironment[]): PlaygroundEnvironment[] {
  return custom.map((e, i) => ({
    ...e,
    id: e.id || `custom-${i}-${e.url}`,
    isCustom: true,
  }));
}

export function EnvironmentSwitcher({
  specId,
  specServers,
  activeUrl,
  onActiveUrlChange,
  variant = "sidebar",
}: EnvironmentSwitcherProps) {
  const isNavbar = variant === "navbar";
  const [environments, setEnvsState] = useState<PlaygroundEnvironment[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  useEffect(() => {
    const fromSpec = serversToEnvironments(specServers);
    const saved = getEnvironments(specId);
    const custom = ensureCustomIds((saved ?? []).filter((e) => e.isCustom));
    const merged = mergeSpecAndCustomEnvironments(fromSpec, custom);
    setEnvsState(merged);

    const savedActive = getActiveEnvironment(specId);
    const active = resolveActiveEnvironment(merged, savedActive);
    if (active) {
      setActiveId(active.id);
      onActiveUrlChange(active.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate env on spec load only
  }, [specId, specServers]);

  const persist = (envs: PlaygroundEnvironment[], id: string, url: string) => {
    setEnvironments(specId, envs.filter((e) => e.isCustom));
    setActiveEnvironment(specId, id);
    setActiveId(id);
    onActiveUrlChange(url);
  };

  const handleSelect = (id: string) => {
    const env = environments.find((e) => e.id === id);
    if (!env) return;
    persist(environments, env.id, env.url);
  };

  const addCustom = () => {
    if (!customName.trim() || !customUrl.trim()) return;
    const url = customUrl.trim().replace(/\/$/, "");
    const entry: PlaygroundEnvironment = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      url,
      isCustom: true,
    };
    const next = dedupeEnvironmentsByUrl([...environments, entry]);
    setEnvsState(next);
    persist(next, entry.id, entry.url);
    setCustomName("");
    setCustomUrl("");
    setShowAdd(false);
  };

  const addForm = (
    <div className="space-y-2">
      <Input
        placeholder="Name (e.g. Staging)"
        value={customName}
        onChange={(e) => setCustomName(e.target.value)}
        className="h-8 text-sm"
      />
      <Input
        placeholder="https://api.example.com"
        value={customUrl}
        onChange={(e) => setCustomUrl(e.target.value)}
        className="h-8 text-sm font-mono"
      />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-8" onClick={addCustom}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => setShowAdd(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  if (isNavbar) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Globe className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
        <Select value={activeId} onValueChange={handleSelect}>
          <SelectTrigger className="h-8 w-[min(200px,40vw)] text-xs">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent align="end">
            {environments.map((env) => (
              <SelectItem key={env.id} value={env.id}>
                <span className="font-medium">{env.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {env.url}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span
          className="hidden md:inline text-[10px] font-mono text-muted-foreground truncate max-w-[140px]"
          title={activeUrl}
        >
          {activeUrl}
        </span>
        <Popover open={showAdd} onOpenChange={setShowAdd}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">
                URL
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <p className="text-xs font-medium mb-2">Add custom environment</p>
            {addForm}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-b border-border pb-4">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary shrink-0" />
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Environment
        </Label>
      </div>
      <Select value={activeId} onValueChange={handleSelect}>
        <SelectTrigger className="w-full h-9 text-sm">
          <SelectValue placeholder="Select environment" />
        </SelectTrigger>
        <SelectContent>
          {environments.map((env) => (
            <SelectItem key={env.id} value={env.id}>
              <span className="font-medium">{env.name}</span>
              <span className="ml-2 text-xs text-muted-foreground truncate">
                {env.url}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showAdd ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2">{addForm}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 gap-1.5 text-xs"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add custom URL
        </Button>
      )}
    </div>
  );
}
