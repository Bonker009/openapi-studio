"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { DbConnectionPublic } from "@/domain/db/types";

type FillFromDbButtonProps = {
  specId: string;
  paramName: string;
  onApply: (value: string) => void;
};

export function FillFromDbButton({
  specId,
  paramName,
  onApply,
}: FillFromDbButtonProps) {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<DbConnectionPublic[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [table, setTable] = useState("");
  const [column, setColumn] = useState(paramName);
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConnections = useCallback(async () => {
    const res = await fetch(`/api/db/connections?specId=${encodeURIComponent(specId)}`);
    const data = await res.json();
    if (res.ok) {
      setConnections(data.connections ?? []);
      if (data.connections?.[0]) setConnectionId(data.connections[0].id);
    }
  }, [specId]);

  useEffect(() => {
    if (open) void loadConnections();
  }, [open, loadConnections]);

  const loadValues = async () => {
    if (!connectionId || !table || !column) return;
    setLoading(true);
    try {
      const res = await fetch("/api/db/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specId,
          connectionId,
          table,
          column,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setValues(data.values ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load values");
    } finally {
      setLoading(false);
    }
  };

  if (connections.length === 0 && !open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        <Database className="h-3 w-3 mr-1" />
        DB
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        <Database className="h-3 w-3 mr-1" />
        From DB
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fill from database</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Connection</Label>
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger>
                  <SelectValue />
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
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Column</Label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={column}
                  onChange={(e) => setColumn(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" onClick={() => void loadValues()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load values"}
            </Button>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {values.map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start font-mono text-xs"
                  onClick={() => {
                    onApply(v);
                    setOpen(false);
                    toast.success(`Applied ${paramName}`);
                  }}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
