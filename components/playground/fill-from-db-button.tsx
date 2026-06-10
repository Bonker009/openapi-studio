"use client";

import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DbTableColumnPicker } from "@/components/db/db-table-column-picker";
import { toast } from "sonner";
import { useState } from "react";

type FillFromDbButtonProps = {
  specId: string;
  paramName: string;
  onApply: (value: string) => void;
};

export function FillFromDbButton({
  specId,
  paramName,
  onApply,
}: FillFromDbButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpen(true)}
      >
        <Database className="h-3 w-3 mr-1" />
        From DB
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fill from database</DialogTitle>
          </DialogHeader>
          <DbTableColumnPicker
            specId={specId}
            paramName={paramName}
            onSelect={(v) => {
              onApply(v);
              setOpen(false);
              toast.success(`Applied ${paramName}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
