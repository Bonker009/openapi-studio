"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  listEndpointNotes,
  appendEndpointNote,
  deleteEndpointNote,
  type EndpointNoteEntry,
} from "@/lib/data-service";
import { toast } from "sonner";

const NOTE_KINDS = [
  { value: "note", label: "Note" },
  { value: "fix", label: "Fix" },
  { value: "todo", label: "Todo" },
  { value: "change", label: "Change" },
] as const;

function formatNoteDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type EndpointChangelogProps = {
  specId: string;
  path: string;
  method: string;
  isOpen: boolean;
};

export function EndpointChangelog({
  specId,
  path,
  method,
  isOpen,
}: EndpointChangelogProps) {
  const [entries, setEntries] = useState<EndpointNoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<string>("note");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const notes = await listEndpointNotes(specId, path, method);
      setEntries(notes);
    } catch {
      toast.error("Failed to load changelog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && specId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when endpoint changes
  }, [isOpen, specId, path, method]);

  const handleAdd = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const note = await appendEndpointNote(specId, path, method, body, kind);
      setEntries((prev) => [note, ...prev]);
      setBody("");
      toast.success("Entry added");
    } catch {
      toast.error("Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    try {
      await deleteEndpointNote(specId, noteId);
      setEntries((prev) => prev.filter((e) => e.id !== noteId));
    } catch {
      toast.error("Failed to delete entry");
    }
  };

  return (
    <div className="mt-8 pt-6 border-t">
      <h3 className="font-medium mb-1">Changelog</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Append-only log — each entry is kept with a timestamp.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="w-full sm:w-[120px] space-y-1">
          <Label htmlFor="changelog-kind" className="text-xs">
            Entry type
          </Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger id="changelog-kind" className="w-full h-9">
              <SelectValue />
            </SelectTrigger>
          <SelectContent>
            {NOTE_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <Label htmlFor="changelog-body" className="text-xs">
            Entry text
          </Label>
          <Textarea
            id="changelog-body"
            placeholder="e.g. Fixed pagination bug 2026-04-12"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[72px] w-full text-sm"
          />
        </div>
        <Button
          className="shrink-0 sm:self-end"
          size="sm"
          onClick={handleAdd}
          disabled={saving || !body.trim()}
        >
          {saving ? "Adding…" : "Add entry"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 italic">
          No changelog entries yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatNoteDate(entry.ts)}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {entry.kind}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(entry.id)}
                  aria-label="Delete entry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {entry.body}
                </ReactMarkdown>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
