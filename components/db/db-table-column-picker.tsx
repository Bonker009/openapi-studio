"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DbConnectionPublic, DbSchemaSnapshot } from "@/domain/db/types";
import { toast } from "sonner";

type DbTableColumnPickerProps = {
  specId: string;
  paramName?: string;
  connectionId?: string;
  onConnectionChange?: (id: string) => void;
  onSelect: (value: string) => void;
};

export function DbTableColumnPicker({
  specId,
  paramName,
  connectionId: controlledConnectionId,
  onConnectionChange,
  onSelect,
}: DbTableColumnPickerProps) {
  const [connections, setConnections] = useState<DbConnectionPublic[]>([]);
  const [connectionId, setConnectionId] = useState(controlledConnectionId ?? "");
  const [schema, setSchema] = useState<DbSchemaSnapshot | null>(null);
  const [tableKey, setTableKey] = useState("");
  const [column, setColumn] = useState(paramName ?? "");
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  const activeConnectionId = controlledConnectionId ?? connectionId;

  const loadConnections = useCallback(async () => {
    const res = await fetch(`/api/db/connections?specId=${encodeURIComponent(specId)}`);
    const data = await res.json();
    if (res.ok) {
      setConnections(data.connections ?? []);
      if (!activeConnectionId && data.connections?.[0]) {
        const id = data.connections[0].id as string;
        setConnectionId(id);
        onConnectionChange?.(id);
      }
    }
  }, [specId, activeConnectionId, onConnectionChange]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (!activeConnectionId) return;
    void (async () => {
      try {
        const res = await fetch(
          `/api/db/connections/${activeConnectionId}/schema?specId=${encodeURIComponent(specId)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSchema(data.schema as DbSchemaSnapshot);
      } catch (e) {
        setSchema(null);
        toast.error(e instanceof Error ? e.message : "Failed to load schema");
      }
    })();
  }, [activeConnectionId, specId]);

  const tables = schema?.tables ?? [];

  const selectedTable = useMemo(() => {
    if (!tableKey) return null;
    const [schemaName, name] = tableKey.split(".");
    return tables.find(
      (t) => t.schema === schemaName && t.name === name
    );
  }, [tableKey, tables]);

  useEffect(() => {
    if (!selectedTable || !paramName) return;
    const match = selectedTable.columns.find(
      (c) => c.name.toLowerCase() === paramName.toLowerCase()
    );
    if (match) setColumn(match.name);
  }, [selectedTable, paramName]);

  const loadValues = async (nextOffset = 0) => {
    if (!activeConnectionId || !selectedTable || !column) return;
    setLoading(true);
    try {
      const res = await fetch("/api/db/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specId,
          connectionId: activeConnectionId,
          schema: selectedTable.schema,
          table: selectedTable.name,
          column,
          offset: nextOffset,
          search: search.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setValues(data.values ?? []);
      setTotal(data.total ?? 0);
      setOffset(nextOffset);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load values");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="space-y-1">
        <Label>Connection</Label>
        <Select
          value={activeConnectionId}
          onValueChange={(id) => {
            setConnectionId(id);
            onConnectionChange?.(id);
            setTableKey("");
            setValues([]);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select connection" />
          </SelectTrigger>
          <SelectContent>
            {connections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Table</Label>
          <Select value={tableKey} onValueChange={setTableKey}>
            <SelectTrigger>
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((t) => (
                <SelectItem key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
                  {t.schema}.{t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Column</Label>
          <Select value={column} onValueChange={setColumn} disabled={!selectedTable}>
            <SelectTrigger>
              <SelectValue placeholder="Column" />
            </SelectTrigger>
            <SelectContent>
              {(selectedTable?.columns ?? []).map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search values…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
        <Button
          size="sm"
          type="button"
          onClick={() => void loadValues(0)}
          disabled={loading || !selectedTable || !column}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
        </Button>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {values.map((v) => (
          <Button
            key={v}
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start font-mono text-xs"
            onClick={() => onSelect(v)}
          >
            {v}
          </Button>
        ))}
      </div>

      {total > values.length + offset ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => void loadValues(offset + values.length)}
          disabled={loading}
        >
          Load more ({offset + values.length} / {total})
        </Button>
      ) : null}
    </div>
  );
}
