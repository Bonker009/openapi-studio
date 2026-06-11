"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTableFacetedFilter } from "@/components/endpoints/data-table-faceted-filter";
import {
  createEndpointColumns,
  type EndpointRow,
  type EndpointColumnOptions,
} from "@/components/endpoints/columns";
import { useControllerColors } from "@/hooks/use-controller-colors";

const METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
  label: m,
  value: m,
}));

const STATUS_OPTIONS = [
  { label: "Working", value: "working" },
  { label: "Not Working", value: "not-working" },
];

type EndpointsDataTableProps = EndpointColumnOptions & {
  data: EndpointRow[];
};

export function EndpointsDataTable({
  data,
  hideController = false,
  getControllerBadgeStyle,
  onToggleStatus,
  onOpenModal,
}: EndpointsDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const { getControllerRowStyle } = useControllerColors();

  const columns = React.useMemo(
    () =>
      createEndpointColumns({
        hideController,
        getControllerBadgeStyle,
        onToggleStatus,
        onOpenModal,
      }),
    [hideController, getControllerBadgeStyle, onToggleStatus, onOpenModal]
  );

  const controllerOptions = React.useMemo(() => {
    const set = new Set(data.map((d) => d.controller));
    return Array.from(set)
      .sort()
      .map((c) => ({ label: c, value: c }));
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = String(filterValue).toLowerCase();
      if (!q) return true;
      const { path, operationId, controller } = row.original;
      return (
        path.toLowerCase().includes(q) ||
        operationId.toLowerCase().includes(q) ||
        controller.toLowerCase().includes(q)
      );
    },
  });

  const isFiltered =
    columnFilters.length > 0 || globalFilter.length > 0 || sorting.length > 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle as="h2">Endpoints</CardTitle>
        <CardDescription className="tabular-nums">
          Showing {table.getFilteredRowModel().rows.length} of {data.length}{" "}
          endpoints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Label htmlFor="endpoints-table-search" className="sr-only">
            Search endpoints
          </Label>
          <Input
            id="endpoints-table-search"
            placeholder="Search path, operation ID, controller…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-full sm:max-w-sm"
          />
          {table.getColumn("method") && (
            <DataTableFacetedFilter
              column={table.getColumn("method")}
              title="Method"
              options={METHOD_OPTIONS}
            />
          )}
          {!hideController && table.getColumn("controller") && (
            <DataTableFacetedFilter
              column={table.getColumn("controller")}
              title="Controller"
              options={controllerOptions}
            />
          )}
          {table.getColumn("working") && (
            <DataTableFacetedFilter
              column={table.getColumn("working")}
              title="Status"
              options={STATUS_OPTIONS}
            />
          )}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 lg:px-3"
              onClick={() => {
                table.resetColumnFilters();
                table.resetSorting();
                setGlobalFilter("");
              }}
            >
              Reset
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-8">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id === "operationId"
                      ? "Operation ID"
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="rounded-md border overflow-hidden">
          <div className="max-h-[min(70vh,800px)] overflow-auto">
            <Table>
              <TableCaption className="sr-only">
                Endpoints for this API specification
              </TableCaption>
              <TableHeader className="sticky top-0 z-10 bg-card">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        scope="col"
                        aria-sort={
                          header.column.getCanSort()
                            ? header.column.getIsSorted() === "asc"
                              ? "ascending"
                              : header.column.getIsSorted() === "desc"
                                ? "descending"
                                : "none"
                            : undefined
                        }
                        className="whitespace-nowrap"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      style={getControllerRowStyle(row.original.controller)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No endpoints found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
