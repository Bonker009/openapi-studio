"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Database, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConnectDbDialog } from "@/components/db/connect-db-dialog";
import { DbTableBrowser } from "@/components/db/db-table-browser";
import { toast } from "sonner";
import type { DbConnectionPublic } from "@/domain/db/types";

type DbAssistantPanelProps = {
  specId: string;
  /** Optional controlled connection (sync with chat composer). */
  connectionId?: string;
  onConnectionIdChange?: (id: string) => void;
};

export function DbAssistantPanel({
  specId,
  connectionId: controlledId,
  onConnectionIdChange,
}: DbAssistantPanelProps) {
  const [connections, setConnections] = useState<DbConnectionPublic[]>([]);
  const [connectionId, setConnectionId] = useState(controlledId ?? "");
  const [connectOpen, setConnectOpen] = useState(false);
  const [indexing, setIndexing] = useState(false);

  const activeId = controlledId ?? connectionId;

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/db/connections?specId=${encodeURIComponent(specId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnections(data.connections ?? []);
      if (data.connections?.[0] && !activeId) {
        const id = data.connections[0].id as string;
        setConnectionId(id);
        onConnectionIdChange?.(id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load connections");
    }
  }, [specId, activeId, onConnectionIdChange]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (controlledId) setConnectionId(controlledId);
  }, [controlledId]);

  const handleIndex = async () => {
    if (!activeId) return;
    setIndexing(true);
    try {
      const intro = await fetch(
        `/api/db/connections/${activeId}/introspect?specId=${encodeURIComponent(specId)}`,
        { method: "POST" }
      );
      if (!intro.ok) {
        const d = await intro.json();
        throw new Error(d.error ?? "Introspect failed");
      }
      const res = await fetch("/api/db/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specId, connectionId: activeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Indexed ${data.chunkCount} tables`);
      void loadConnections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Index failed");
    } finally {
      setIndexing(false);
    }
  };

  const handleDelete = async () => {
    if (!activeId) return;
    try {
      const res = await fetch(
        `/api/db/connections/${activeId}?specId=${encodeURIComponent(specId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("Connection removed");
      setConnectionId("");
      onConnectionIdChange?.("");
      void loadConnections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect a read-only PostgreSQL database and index its schema for the
          unified chat assistant and playground param filling.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setConnectOpen(true)}>
            <Database className="h-4 w-4 mr-1" />
            Connect
          </Button>
          {activeId ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleIndex()}
                disabled={indexing}
              >
                {indexing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Index schema
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void handleDelete()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>

        {connections.length > 0 ? (
          <Select
            value={activeId}
            onValueChange={(id) => {
              setConnectionId(id);
              onConnectionIdChange?.(id);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select connection" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label} ({c.status}) — {c.indexedChunkCount ?? 0} chunks
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Alert>
            <AlertTitle>No database connected</AlertTitle>
            <AlertDescription>
              Use Connect to add a read-only PostgreSQL source.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {activeId ? (
        <div className="space-y-2 min-w-0">
          <h3 className="text-sm font-medium">Browse tables</h3>
          <DbTableBrowser specId={specId} connectionId={activeId} />
        </div>
      ) : null}

      <ConnectDbDialog
        specId={specId}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => void loadConnections()}
      />
    </div>
  );
}
