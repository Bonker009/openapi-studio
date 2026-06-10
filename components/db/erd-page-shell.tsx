"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileCode2,
  GitBranch,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErdSchemaEditor } from "@/components/db/erd-schema-editor";
import { toast } from "sonner";
import {
  ERD_PASTE_FORMATS,
  estimateEntityCount,
  type ErdPasteFormat,
  getErdPasteFormatMeta,
} from "@/domain/db/erd-paste-schema";

type ErdPageShellProps = {
  specId: string;
  specTitle?: string;
};

export function ErdPageShell({ specId, specTitle = "API" }: ErdPageShellProps) {
  const router = useRouter();
  const [format, setFormat] = useState<ErdPasteFormat>("postgres");
  const [schema, setSchema] = useState("");
  const [building, setBuilding] = useState(false);

  const formatMeta = getErdPasteFormatMeta(format);
  const entityCount = useMemo(() => {
    if (!schema.trim()) return 0;
    try {
      return estimateEntityCount(schema, format);
    } catch {
      return 0;
    }
  }, [schema, format]);

  const charCount = useMemo(() => new TextEncoder().encode(schema).length, [schema]);

  const handleLoadExample = () => {
    setSchema(formatMeta.example);
  };

  const handleClear = () => {
    setSchema("");
  };

  const handleFormatChange = (next: ErdPasteFormat) => {
    setFormat(next);
    if (!schema.trim()) {
      setSchema(getErdPasteFormatMeta(next).example);
    }
  };

  const handleGenerate = async () => {
    if (!schema.trim()) {
      toast.error("Paste your schema first");
      return;
    }
    setBuilding(true);
    try {
      const qs = new URLSearchParams({ specId });
      const res = await fetch(`/api/db/erd/build?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, format }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/documentation/${specId}/erd/${data.cacheKey}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to build ER diagram");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="shrink-0 z-20 bg-card border-b border-border">
        <div className="h-1 bg-primary w-full" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" asChild>
            <Link href={`/documentation/${specId}`}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to documentation</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
              ER Diagram
            </p>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate mt-0.5">
              {specTitle}
            </h1>
          </div>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href={`/documentation/${specId}/playground`}>Playground</Link>
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto w-full space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Database ER diagram
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Paste your schema below, choose a format, and generate an interactive
              entity-relationship diagram with Liam ERD. No database connection required.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 md:p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-2 min-w-[200px]">
                <label className="text-sm font-medium">Schema format</label>
                <Select
                  value={format}
                  onValueChange={(v) => handleFormatChange(v as ErdPasteFormat)}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ERD_PASTE_FORMATS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={handleLoadExample}
              >
                <Sparkles className="h-4 w-4" />
                Load example
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <FileCode2 className="h-4 w-4 text-muted-foreground" />
                  Schema
                </label>
                <div className="flex flex-wrap gap-2">
                  {entityCount > 0 ? (
                    <Badge variant="secondary">
                      ~{entityCount} {entityCount === 1 ? "table" : "tables"}
                    </Badge>
                  ) : schema.trim() ? (
                    <Badge variant="outline">No tables detected yet</Badge>
                  ) : null}
                  <Badge variant="outline">{charCount.toLocaleString()} bytes</Badge>
                </div>
              </div>
              <ErdSchemaEditor
                value={schema}
                onChange={setSchema}
                format={format}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Supports PostgreSQL DDL, Prisma schema, and Drizzle TypeScript.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={!schema.trim() || building}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleGenerate()}
                  disabled={building || !schema.trim()}
                >
                  {building ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <GitBranch className="h-4 w-4 mr-1.5" />
                  )}
                  Generate diagram
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
