"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { deleteSpec } from "@/lib/data-service";
import type { ApiSpecificationSummary } from "../types";

export function useSpecDeletion(
  setSpecs: React.Dispatch<React.SetStateAction<ApiSpecificationSummary[]>>,
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel: string;
    variant: "destructive";
  }) => Promise<boolean>
) {
  const deleteSpecification = useCallback(
    async (id: string, title: string) => {
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
    },
    [confirm, setSpecs]
  );

  return { deleteSpecification };
}
