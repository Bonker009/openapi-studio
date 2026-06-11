"use client";

import { useMemo } from "react";
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
import { Header } from "@/components/header";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Upload, Search, LayoutGrid, LayoutList } from "lucide-react";
import { useConfirmDialog } from "@/components/confirm-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useSpecs,
  useSpecSearch,
  useSpecSorting,
  useViewPreference,
  useSpecDeletion,
} from "@/src/features/specs/hooks";
import { filterAndSortSpecs } from "@/src/features/specs/utils/filter-and-sort";
import { SpecListSection } from "@/src/features/specs/components/spec-list";
import type { ViewMode } from "@/src/features/specs/types";

export default function Home() {
  const { specs, setSpecs, loading } = useSpecs();
  const { search, setSearch } = useSpecSearch();
  const { sort, setSort, sortLabel } = useSpecSorting();
  const { viewMode, setViewMode } = useViewPreference();
  const { confirm, dialog } = useConfirmDialog();
  const { deleteSpecification } = useSpecDeletion(setSpecs, confirm);

  const filtered = useMemo(
    () => filterAndSortSpecs(specs, search, sort),
    [specs, search, sort],
  );

  const specContent = (
    <SpecListSection
      viewMode={viewMode}
      loading={loading}
      specs={filtered}
      onDelete={deleteSpecification}
    />
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
