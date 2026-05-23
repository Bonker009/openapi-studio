"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { listSpecs, deleteSpec } from "@/lib/data-service";
import {
  FileText,
  Plus,
  Upload,
  Search,
  History,
  Trash2,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ApiSpec = {
  id: string;
  title: string;
  description?: string;
  version: string;
  lastModified: string;
};

type DisplaySpec = ApiSpec & { displayTitle: string };

type SortKey = "modified" | "name" | "version";
type ViewMode = "list" | "grid";

const VIEW_STORAGE_KEY = "poseidon-home-view";

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getDisplayNames(specs: ApiSpec[]): DisplaySpec[] {
  const nameCount: Record<string, number> = {};
  return specs.map((spec) => {
    const base = spec.title || "Untitled";
    if (!nameCount[base]) {
      nameCount[base] = 1;
      return { ...spec, displayTitle: base };
    }
    nameCount[base]++;
    return { ...spec, displayTitle: `${base} (${nameCount[base]})` };
  });
}

function SpecMeta({ spec }: { spec: DisplaySpec }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1.5">
      <Badge variant="info" className="tabular-nums">
        v{spec.version}
      </Badge>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(spec.lastModified)}
      </span>
    </div>
  );
}

function SpecActions({
  spec,
  onDelete,
  compact = false,
}: {
  spec: DisplaySpec;
  onDelete: (id: string, title: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex gap-2 shrink-0 ${compact ? "flex-col w-full" : "flex-wrap"}`}>
      <Button size="sm" className={compact ? "w-full" : undefined} asChild>
        <Link href={`/documentation/${spec.id}`}>View Docs</Link>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={compact ? "w-full" : undefined}
        asChild
      >
        <Link href={`/documentation/${spec.id}/history`}>
          <History className="h-4 w-4 mr-1" />
          History
        </Link>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`text-destructive hover:text-destructive ${compact ? "w-full" : ""}`}
        onClick={() => onDelete(spec.id, spec.displayTitle)}
      >
        <Trash2 className="h-4 w-4" />
        {compact && <span className="ml-1">Delete</span>}
      </Button>
    </div>
  );
}

function ListSpecRow({
  spec,
  onDelete,
}: {
  spec: DisplaySpec;
  onDelete: (id: string, title: string) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden bg-card hover:bg-muted/30 transition-colors">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-medium truncate">{spec.displayTitle}</div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {spec.id}
            </p>
            <SpecMeta spec={spec} />
          </div>
        </div>
        <SpecActions spec={spec} onDelete={onDelete} />
      </div>
    </div>
  );
}

function GridSpecCard({
  spec,
  onDelete,
}: {
  spec: DisplaySpec;
  onDelete: (id: string, title: string) => void;
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow flex flex-col gap-0">
      <CardHeader className="pb-0">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0 align-middle">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate leading-snug">
              {spec.displayTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {spec.id}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pt-0">
        {spec.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
            {spec.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            No description
          </p>
        )}
        <SpecMeta spec={spec} />
        <div className="mt-4 pt-4 border-t border-border">
          <SpecActions spec={spec} onDelete={onDelete} compact />
        </div>
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 border-2 border-dashed rounded-xl border-border">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h2 className="text-2xl font-semibold mb-2">No API specifications yet</h2>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Upload an OpenAPI spec to explore endpoints and track versions over time.
      </p>
      <Button size="lg" asChild>
        <Link href="/upload">
          <Plus className="h-4 w-4 mr-2" />
          Add specification
        </Link>
      </Button>
    </div>
  );
}

export default function Home() {
  const [specs, setSpecs] = useState<ApiSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("modified");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const { confirm, dialog } = useConfirmDialog();

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "grid") {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    async function loadSpecs() {
      try {
        setLoading(true);
        const specsList = await listSpecs();
        setSpecs(specsList);
      } catch {
        toast.error("Failed to load API specifications");
      } finally {
        setLoading(false);
      }
    }
    loadSpecs();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({
      title: "Delete specification?",
      description: `Remove "${title}" and all version history. This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteSpec(id);
      setSpecs((prev) => prev.filter((spec) => spec.id !== id));
      toast.success("Specification deleted");
    } catch {
      toast.error("Failed to delete specification");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = getDisplayNames(specs);
    if (q) {
      list = list.filter(
        (s) =>
          s.displayTitle.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.version.toLowerCase().includes(q) ||
          (s.description?.toLowerCase().includes(q) ?? false)
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "name") {
        return a.displayTitle.localeCompare(b.displayTitle);
      }
      if (sort === "version") {
        return a.version.localeCompare(b.version);
      }
      return (
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
    });
    return list;
  }, [specs, search, sort]);

  const sortLabel =
    sort === "modified"
      ? "Last modified"
      : sort === "name"
        ? "Name"
        : "Version";

  const specContent = loading ? (
    viewMode === "list" ? (
      <ListSkeleton />
    ) : (
      <GridSkeleton />
    )
  ) : filtered.length > 0 ? (
    viewMode === "list" ? (
      <div className="space-y-2">
        {filtered.map((spec) => (
          <ListSpecRow key={spec.id} spec={spec} onDelete={handleDelete} />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((spec) => (
          <GridSpecCard key={spec.id} spec={spec} onDelete={handleDelete} />
        ))}
      </div>
    )
  ) : (
    <EmptyState />
  );

  return (
    <div className="min-h-screen bg-background">
      {dialog}
      <Header title="Poseidon" showBackButton={false} showHomeButton={false} />

      <main id="main-content" className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Label htmlFor="spec-search" className="sr-only">
              Search specifications
            </Label>
            <Input
              id="spec-search"
              placeholder="Search specifications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Sort: {sortLabel}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              <div className="flex flex-col gap-1">
                {(
                  [
                    ["modified", "Last modified"],
                    ["name", "Name"],
                    ["version", "Version"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    variant={sort === key ? "secondary" : "ghost"}
                    size="sm"
                    className="justify-start"
                    onClick={() => setSort(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <ToggleGroup
            type="single"
            variant="outline"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <LayoutList className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button asChild>
            <Link href="/upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Link>
          </Button>
        </div>

        {viewMode === "list" ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle as="h2">API Documentation</CardTitle>
              <CardDescription>
                View and manage your OpenAPI specifications
              </CardDescription>
            </CardHeader>
            <CardContent>{specContent}</CardContent>
          </Card>
        ) : (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight">
                API Documentation
              </h2>
              <p className="text-sm text-muted-foreground">
                View and manage your OpenAPI specifications
              </p>
            </div>
            {specContent}
          </section>
        )}
      </main>
    </div>
  );
}
