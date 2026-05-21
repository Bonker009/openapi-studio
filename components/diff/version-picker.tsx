"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/data-service";

type VersionPickerProps = {
  label: string;
  value: string;
  entries: HistoryEntry[];
  onChange: (ts: string) => void;
  allowCurrent?: boolean;
  formatDate: (ts: string) => string;
};

export function VersionPicker({
  label,
  value,
  entries,
  onChange,
  allowCurrent = false,
  formatDate,
}: VersionPickerProps) {
  const [open, setOpen] = useState(false);

  const displayLabel =
    value === "current"
      ? "Current (latest)"
      : entries.find((e) => e.ts === value)
        ? `v${entries.find((e) => e.ts === value)!.version} · ${formatDate(value)}`
        : value
          ? formatDate(value)
          : "Select version…";

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-auto min-h-9 py-2"
          >
            <span className="truncate text-left text-sm">{displayLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search versions…" />
            <CommandList>
              <CommandEmpty>No version found.</CommandEmpty>
              <CommandGroup>
                {allowCurrent && (
                  <CommandItem
                    value="current latest"
                    onSelect={() => {
                      onChange("current");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === "current" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Current (latest saved)
                  </CommandItem>
                )}
                {entries.map((entry) => (
                  <CommandItem
                    key={entry.ts}
                    value={`${entry.version} ${entry.ts} ${entry.note ?? ""}`}
                    onSelect={() => {
                      onChange(entry.ts);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === entry.ts ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium tabular-nums">
                        v{entry.version}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.ts)}
                        {entry.summaryLabel ? ` · ${entry.summaryLabel}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
