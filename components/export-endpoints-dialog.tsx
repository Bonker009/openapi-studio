"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  downloadExcel,
  slugifyFileName,
  type ExportColumn,
} from "@/lib/export-excel";
import { toast } from "sonner";

export type ExportEndpointRow = {
  path: string;
  method: string;
  controller: string;
  operationId: string;
  working: boolean;
  notes: string;
};

type ColumnId =
  | "method"
  | "path"
  | "controller"
  | "operationId"
  | "status"
  | "notes";

const COLUMN_DEFS: { id: ColumnId; label: string }[] = [
  { id: "method", label: "Method" },
  { id: "path", label: "Path" },
  { id: "controller", label: "Controller" },
  { id: "operationId", label: "Operation ID" },
  { id: "status", label: "Status" },
  { id: "notes", label: "Notes" },
];

const DEFAULT_COLUMNS: Record<ColumnId, boolean> = {
  method: true,
  path: true,
  controller: true,
  operationId: true,
  status: true,
  notes: true,
};

type StatusFilter = "all" | "working" | "not-working";

function MultiFilterPopover({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const selectedSet = new Set(selected);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="h-4 w-4" />
          {title}
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selected.length}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const next = new Set(selectedSet);
                      if (isSelected) next.delete(option.value);
                      else next.add(option.value);
                      onChange(Array.from(next));
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])}>
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type ExportEndpointsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoints: ExportEndpointRow[];
  defaultFileName: string;
};

export function ExportEndpointsDialog({
  open,
  onOpenChange,
  endpoints,
  defaultFileName,
}: ExportEndpointsDialogProps) {
  const [columns, setColumns] =
    useState<Record<ColumnId, boolean>>(DEFAULT_COLUMNS);
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [controllerFilter, setControllerFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (open) {
      setFileName(slugifyFileName(defaultFileName || "api-endpoints"));
      setColumns(DEFAULT_COLUMNS);
      setMethodFilter([]);
      setControllerFilter([]);
      setStatusFilter("all");
    }
  }, [open, defaultFileName]);

  const methodOptions = useMemo(() => {
    const set = new Set(endpoints.map((e) => e.method));
    return Array.from(set)
      .sort()
      .map((m) => ({ label: m, value: m }));
  }, [endpoints]);

  const controllerOptions = useMemo(() => {
    const set = new Set(endpoints.map((e) => e.controller));
    return Array.from(set)
      .sort()
      .map((c) => ({ label: c, value: c }));
  }, [endpoints]);

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      if (methodFilter.length > 0 && !methodFilter.includes(ep.method)) {
        return false;
      }
      if (
        controllerFilter.length > 0 &&
        !controllerFilter.includes(ep.controller)
      ) {
        return false;
      }
      if (statusFilter === "working" && !ep.working) return false;
      if (statusFilter === "not-working" && ep.working) return false;
      return true;
    });
  }, [endpoints, methodFilter, controllerFilter, statusFilter]);

  const activeColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => columns[c.id]),
    [columns]
  );

  const handleDownload = async () => {
    if (activeColumns.length === 0 || filteredEndpoints.length === 0) return;

    const exportColumns: ExportColumn[] = activeColumns.map((c) => ({
      id: c.id,
      label: c.label,
    }));

    const rows = filteredEndpoints.map((ep) => ({
      method: ep.method,
      path: ep.path,
      controller: ep.controller,
      operationId: ep.operationId,
      status: ep.working ? "Working" : "Not Working",
      notes: ep.notes,
    }));

    const toastId = toast.loading("Preparing Excel export…");
    try {
      await downloadExcel(fileName, rows, exportColumns);
      toast.success("Excel file downloaded", {
        id: toastId,
        description: `${filteredEndpoints.length} endpoints exported`,
      });
      onOpenChange(false);
    } catch {
      toast.error("Export failed", {
        id: toastId,
        description: "Could not generate the Excel file. Try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export endpoints</DialogTitle>
          <DialogDescription>
            Choose columns and filters, then download an Excel (.xlsx) file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Columns</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {COLUMN_DEFS.map((col) => (
                <div key={col.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`export-col-${col.id}`}
                    checked={columns[col.id]}
                    onCheckedChange={(checked) =>
                      setColumns((prev) => ({
                        ...prev,
                        [col.id]: checked === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor={`export-col-${col.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Filters</Label>
            <div className="flex flex-wrap gap-2">
              <MultiFilterPopover
                title="Method"
                options={methodOptions}
                selected={methodFilter}
                onChange={setMethodFilter}
              />
              <MultiFilterPopover
                title="Controller"
                options={controllerOptions}
                selected={controllerFilter}
                onChange={setControllerFilter}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <PlusCircle className="h-4 w-4" />
                    Status
                    {statusFilter !== "all" && (
                      <>
                        <Separator orientation="vertical" className="mx-2 h-4" />
                        <Badge
                          variant="secondary"
                          className="rounded-sm px-1 font-normal"
                        >
                          {statusFilter === "working" ? "Working" : "Not working"}
                        </Badge>
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-0" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {(
                          [
                            { label: "All", value: "all" },
                            { label: "Working", value: "working" },
                            { label: "Not working", value: "not-working" },
                          ] as const
                        ).map((opt) => (
                          <CommandItem
                            key={opt.value}
                            onSelect={() => setStatusFilter(opt.value)}
                          >
                            <div
                              className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                statusFilter === opt.value
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible"
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            {opt.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="export-filename" className="text-sm font-medium">
              File name
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="export-filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="font-mono text-sm"
              />
              <span className="text-sm text-muted-foreground shrink-0">.xlsx</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground tabular-nums">
            Exporting{" "}
            <span className="font-medium text-foreground">
              {filteredEndpoints.length}
            </span>{" "}
            of {endpoints.length} endpoints
            {activeColumns.length > 0 && (
              <> · {activeColumns.length} columns</>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={
              filteredEndpoints.length === 0 || activeColumns.length === 0
            }
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
