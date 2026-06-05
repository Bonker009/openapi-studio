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
import { Textarea } from "@/components/ui/textarea";
import { ConnectDbDialog } from "@/components/db/connect-db-dialog";
import { toast } from "sonner";
import type { DbConnectionPublic } from "@/domain/db/types";

type DbAssistantPanelProps = {
  specId: string;
};

export function DbAssistantPanel({ specId }: DbAssistantPanelProps) {
  const [connections, setConnections] = useState<DbConnectionPublic[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch(`/api/db/connections?specId=${encodeURIComponent(specId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnections(data.connections ?? []);
      if (data.connections?.[0] && !connectionId) {
        setConnectionId(data.connections[0].id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load connections");
    }
  }, [specId, connectionId]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const handleIndex = async () => {
    if (!connectionId) return;
    setIndexing(true);
    try {
      const intro = await fetch(
        `/api/db/connections/${connectionId}/introspect?specId=${encodeURIComponent(specId)}`,
        { method: "POST" }
      );
      if (!intro.ok) {
        const d = await intro.json();
        throw new Error(d.error ?? "Introspect failed");
      }
      const res = await fetch("/api/db/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specId, connectionId }),
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

  const handleAsk = async () => {
    if (!connectionId || !question.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch("/api/db/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specId,
          connectionId,
          question: question.trim(),
          conversationId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnswer(data.answer ?? "");
      if (data.conversationId) setConversationId(data.conversationId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Question failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!connectionId) return;
    try {
      const res = await fetch(
        `/api/db/connections/${connectionId}?specId=${encodeURIComponent(specId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("Connection removed");
      setConnectionId("");
      void loadConnections();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect a read-only PostgreSQL database, index schema for RAG, then ask
        questions or fill playground params from real IDs.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setConnectOpen(true)}>
          <Database className="h-4 w-4 mr-1" />
          Connect
        </Button>
        {connectionId ? (
          <>
            <Button size="sm" variant="outline" onClick={() => void handleIndex()} disabled={indexing}>
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
        <Select value={connectionId} onValueChange={setConnectionId}>
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
          <AlertDescription>Use Connect to add a read-only PostgreSQL source.</AlertDescription>
        </Alert>
      )}

      <Textarea
        placeholder="Ask about your schema or data (e.g. Which table stores user IDs?)"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="min-h-20"
      />
      <Button onClick={() => void handleAsk()} disabled={loading || !connectionId}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Ask database
      </Button>
      {answer ? (
        <pre className="text-xs whitespace-pre-wrap rounded-md border p-3 bg-muted/30 max-h-64 overflow-y-auto">
          {answer}
        </pre>
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
