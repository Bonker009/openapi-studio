"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DbSchemaSnapshot } from "@/domain/db/types";
import { toast } from "sonner";

type DbTableBrowserProps = {
  specId: string;
  connectionId: string;
};

export function DbTableBrowser({ specId, connectionId }: DbTableBrowserProps) {
  const [schema, setSchema] = useState<DbSchemaSnapshot | null>(null);
  const [tableKey, setTableKey] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/db/connections/${connectionId}/schema?specId=${encodeURIComponent(specId)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSchema(data.schema as DbSchemaSnapshot);
      } catch (e) {
        setSchema(null);
        toast.error(e instanceof Error ? e.message : "Failed to load schema");
      }
    })();
  }, [connectionId, specId]);

  const tables = schema?.tables ?? [];
  const selected = useMemo(() => {
    if (!tableKey) return null;
    const [sch, name] = tableKey.split(".");
    return tables.find((t) => t.schema === sch && t.name === name) ?? null;
  }, [tableKey, tables]);

  const loadBrowse = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/db/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specId,
          connectionId,
          schema: selected.schema,
          table: selected.name,
          page,
          pageSize,
          sortColumn: sortColumn ?? undefined,
          sortDir,
          search: debouncedSearch.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows ?? []);
      setColumns(data.columns ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Browse failed");
    } finally {
      setLoading(false);
    }
  }, [
    selected,
    specId,
    connectionId,
    page,
    pageSize,
    sortColumn,
    sortDir,
    debouncedSearch,
  ]);

  useEffect(() => {
    if (selected) void loadBrowse();
  }, [loadBrowse, selected]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const formatCell = (v: unknown) => {
    if (v == null) return <span className="text-muted-foreground text-[10px]">NULL</span>;
    const s = String(v);
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  };

  return (
    <div className="space-y-3 min-w-0">
      <Select
        value={tableKey}
        onValueChange={(v) => {
          setTableKey(v);
          setPage(1);
          setSortColumn(null);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select table to browse" />
        </SelectTrigger>
        <SelectContent>
          {tables.map((t) => (
            <SelectItem key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
              {t.schema}.{t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected ? (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Search rows…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="rounded-md border overflow-x-auto min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead
                        key={col}
                        className="cursor-pointer whitespace-nowrap text-xs"
                        onClick={() => toggleSort(col)}
                      >
                        {col}
                        {sortColumn === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length || 1} className="text-center text-sm text-muted-foreground">
                        No rows
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((col) => (
                          <TableCell key={col} className="font-mono text-xs max-w-[200px] truncate">
                            {formatCell(row[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {total} row{total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
