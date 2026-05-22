"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  getActiveToken,
  getTokens,
  setActiveToken,
  setTokens,
} from "@/lib/playground/storage";
import {
  formatExpiryLabel,
  isExpiringSoon,
  secondsUntilExpiry,
} from "@/lib/playground/token-utils";
import { useTokenExpiry } from "@/lib/playground/use-token-expiry";
import { cn } from "@/lib/utils";

type TokenPanelProps = {
  specId: string;
  activeTokenName: string | null;
  activeTokenValue: string | null;
  onActiveChange: (name: string | null, value: string | null) => void;
  variant?: "sidebar" | "navbar";
};

export function TokenPanel({
  specId,
  activeTokenName,
  activeTokenValue,
  onActiveChange,
  variant = "sidebar",
}: TokenPanelProps) {
  const isNavbar = variant === "navbar";
  const [tokens, setTokensState] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);

  useTokenExpiry(activeTokenValue);

  useEffect(() => {
    const saved = getTokens(specId);
    if (saved) setTokensState(saved);
    const active = getActiveToken(specId);
    if (active && saved?.[active]) {
      onActiveChange(active, saved[active]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load persisted token once per spec
  }, [specId]);

  useEffect(() => {
    if (!activeTokenValue) {
      setExpiryLabel(null);
      return;
    }
    const update = () => setExpiryLabel(formatExpiryLabel(activeTokenValue));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeTokenValue]);

  const persistTokens = (next: Record<string, string>) => {
    setTokensState(next);
    setTokens(specId, next);
  };

  const selectToken = (name: string) => {
    const value = tokens[name] ?? null;
    setActiveToken(specId, name);
    onActiveChange(name, value);
  };

  const clearToken = () => {
    setActiveToken(specId, null);
    onActiveChange(null, null);
  };

  const addToken = () => {
    if (!newName.trim() || !newValue.trim()) return;
    const next = { ...tokens, [newName.trim()]: newValue.trim() };
    persistTokens(next);
    selectToken(newName.trim());
    setNewName("");
    setNewValue("");
    setShowAdd(false);
  };

  const removeToken = (name: string) => {
    const next = { ...tokens };
    delete next[name];
    persistTokens(next);
    if (activeTokenName === name) clearToken();
  };

  const names = Object.keys(tokens);
  const expiringSoon =
    activeTokenValue && isExpiringSoon(activeTokenValue, 300);
  const expired =
    activeTokenValue &&
    secondsUntilExpiry(activeTokenValue) !== null &&
    (secondsUntilExpiry(activeTokenValue) ?? 1) <= 0;

  const expiryBadge = expiryLabel && (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] tabular-nums shrink-0",
        expired && "bg-destructive/10 text-destructive border-destructive/20",
        expiringSoon &&
          !expired &&
          "bg-amber-50 text-amber-800 border-amber-200"
      )}
    >
      {expiryLabel}
    </Badge>
  );

  const addForm = (
    <div className="space-y-2">
      <Input
        placeholder="Role name (e.g. Admin)"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="h-8 text-sm"
      />
      <Input
        type="password"
        placeholder="Bearer token"
        value={newValue}
        onChange={(e) => setNewValue(e.target.value)}
        className="h-8 text-sm font-mono"
      />
      <Button size="sm" className="w-full h-8" onClick={addToken}>
        Save token
      </Button>
    </div>
  );

  const tokenManageList = names.length > 0 && (
    <ul className="space-y-1 border-t pt-2 mt-2">
      {names.map((name) => (
        <li
          key={name}
          className="flex items-center justify-between gap-2 text-xs rounded-md px-2 py-1 bg-muted/40"
        >
          <button
            type="button"
            className="truncate font-medium text-left hover:underline"
            onClick={() => selectToken(name)}
          >
            {name}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeToken(name)}
            aria-label={`Remove ${name}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </li>
      ))}
    </ul>
  );

  if (isNavbar) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <KeyRound className="h-4 w-4 text-primary shrink-0 hidden sm:block" />
        <Select
          value={activeTokenName ?? "__none__"}
          onValueChange={(v) =>
            v === "__none__" ? clearToken() : selectToken(v)
          }
        >
          <SelectTrigger className="h-8 w-[min(160px,36vw)] text-xs">
            <SelectValue placeholder="Role / token" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="__none__">No auth</SelectItem>
            {names.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {expiryBadge}
        <Popover open={showAdd} onOpenChange={setShowAdd}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">
                Token
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <p className="text-xs font-medium mb-2">Role / token</p>
            {addForm}
            {tokenManageList}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-b border-border pb-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary shrink-0" />
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Role / Token
        </Label>
      </div>

      {names.length > 0 ? (
        <Select
          value={activeTokenName ?? "__none__"}
          onValueChange={(v) => (v === "__none__" ? clearToken() : selectToken(v))}
        >
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Select role token" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No auth</SelectItem>
            {names.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">No tokens saved yet</p>
      )}

      {activeTokenName && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {activeTokenName}
          </Badge>
          {expiryBadge}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={clearToken}
          >
            Clear
          </Button>
        </div>
      )}

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
          Add role token
        </Button>
      )}

      {tokenManageList}
    </div>
  );
}
