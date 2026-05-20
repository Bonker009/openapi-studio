"use client";

import type { CSSProperties } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Check, Info, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MethodBadge } from "@/components/method-badge";

export type EndpointRow = {
  path: string;
  method: string;
  controller: string;
  operationId: string;
  working: boolean;
  notes: string;
};

export type EndpointColumnOptions = {
  hideController?: boolean;
  getControllerBadgeStyle: (controller: string) => CSSProperties;
  onToggleStatus: (path: string, method: string) => void;
  onOpenModal: (endpoint: EndpointRow) => void;
};

export function createEndpointColumns(
  options: EndpointColumnOptions
): ColumnDef<EndpointRow>[] {
  const { hideController, getControllerBadgeStyle, onToggleStatus, onOpenModal } =
    options;

  const columns: ColumnDef<EndpointRow>[] = [
    {
      accessorKey: "method",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Method
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <MethodBadge method={row.getValue("method")} />,
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true;
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "path",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Path
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium font-mono text-xs tabular-nums">
          {row.getValue("path")}
        </span>
      ),
    },
  ];

  if (!hideController) {
    columns.push({
      accessorKey: "controller",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Controller
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          style={getControllerBadgeStyle(row.getValue("controller"))}
        >
          {row.getValue("controller")}
        </Badge>
      ),
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true;
        return value.includes(row.getValue(id));
      },
    });
  }

  columns.push(
    {
      accessorKey: "operationId",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Operation ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.getValue("operationId")}
        </span>
      ),
    },
    {
      accessorKey: "working",
      header: "Status",
      cell: ({ row }) => {
        const endpoint = row.original;
        const working = row.getValue("working") as boolean;
        return (
          <Button
            variant={working ? "default" : "outline"}
            size="sm"
            onClick={() => onToggleStatus(endpoint.path, endpoint.method)}
            className="flex items-center"
          >
            {working ? (
              <>
                <Check className="h-4 w-4 mr-1" /> Working
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-1" /> Not Working
              </>
            )}
          </Button>
        );
      },
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true;
        const working = row.getValue(id) as boolean;
        const key = working ? "working" : "not-working";
        return value.includes(key);
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      enableSorting: false,
      cell: ({ row }) => {
        const notes = row.getValue("notes") as string;
        return notes ? (
          <div className="max-w-[200px] truncate" title={notes}>
            {notes}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">No notes</span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Details</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenModal(row.original)}
          className="flex items-center"
        >
          <Info className="h-4 w-4" />
          <span className="sr-only">View Details</span>
        </Button>
      ),
    }
  );

  return columns;
}
