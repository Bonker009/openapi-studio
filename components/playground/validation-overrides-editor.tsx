"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import type { OverrideMap } from "@/lib/validation/types";
type Row = { key: string; value: string };

function mapToRows(map: OverrideMap): Row[] {
  return Object.entries(map).map(([key, value]) => ({ key, value }));
}

function rowsToMap(rows: Row[]): OverrideMap {
  const out: OverrideMap = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    out[k] = row.value;
  }
  return out;
}

type ValidationOverridesEditorProps = {
  title: string;
  description?: string;
  overrides: OverrideMap;
  onChange: (overrides: OverrideMap) => void;
  onAutoSuggest?: () => void;
  disabled?: boolean;
  debounceMs?: number;
};

export function ValidationOverridesEditor({
  title,
  description,
  overrides,
  onChange,
  onAutoSuggest,
  disabled,
  debounceMs = 300,
}: ValidationOverridesEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => mapToRows(overrides));
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(overrides, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setRows(mapToRows(overrides));
    setJsonText(JSON.stringify(overrides, null, 2));
  }, [overrides]);

  const emitChange = useCallback(
    (map: OverrideMap) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(map);
      }, debounceMs);
    },
    [debounceMs]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const syncRows = useCallback(
    (next: Row[]) => {
      setRows(next);
      const map = rowsToMap(next);
      emitChange(map);
      setJsonText(JSON.stringify(map, null, 2));
      setJsonError(null);
    },
    [emitChange]
  );

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("JSON must be an object");
        return;
      }
      const map: OverrideMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        map[k] = v == null ? "" : String(v);
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onChangeRef.current(map);
      setRows(mapToRows(map));
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>

      <Tabs defaultValue="table">
        <TabsList className="h-8">
          <TabsTrigger value="table" className="text-xs">
            Table
          </TabsTrigger>
          <TabsTrigger value="json" className="text-xs">
            JSON
          </TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="space-y-2 mt-2">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No overrides. Add fields or use auto-suggest.
              </p>
            ) : null}
            {rows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  placeholder="fieldName"
                  value={row.key}
                  disabled={disabled}
                  className="h-8 text-xs font-mono flex-1"
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...next[idx], key: e.target.value };
                    syncRows(next);
                  }}
                />
                <Input
                  placeholder="real value"
                  value={row.value}
                  disabled={disabled}
                  className="h-8 text-xs flex-1"
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...next[idx], value: e.target.value };
                    syncRows(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={disabled}
                  onClick={() => syncRows(rows.filter((_, i) => i !== idx))}
                  aria-label="Remove row"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => syncRows([...rows, { key: "", value: "" }])}
            >
              <Plus className="size-3 mr-1" aria-hidden />
              Add field
            </Button>
            {onAutoSuggest ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={disabled}
                onClick={onAutoSuggest}
              >
                <Sparkles className="size-3 mr-1" aria-hidden />
                Auto-suggest
              </Button>
            ) : null}
          </div>
        </TabsContent>
        <TabsContent value="json" className="space-y-2 mt-2">
          <Label htmlFor={`validation-overrides-json-${title}`} className="sr-only">
            Overrides JSON
          </Label>
          <textarea
            id={`validation-overrides-json-${title}`}
            className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-xs font-mono"
            value={jsonText}
            disabled={disabled}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {jsonError ? (
            <p className="text-xs text-destructive">{jsonError}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={applyJson}
          >
            Apply JSON
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function endpointEditorTitle(endpoint: PlaygroundEndpoint): string {
  return `${endpoint.method} ${endpoint.path}`;
}

export function globalEditorTitle(): string {
  return "Global defaults (fallback)";
}
