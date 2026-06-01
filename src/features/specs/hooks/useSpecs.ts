"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listSpecs } from "@/lib/data-service";
import type { ApiSpecificationSummary } from "../types";

export function useSpecs() {
  const [specs, setSpecs] = useState<ApiSpecificationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const specsList = await listSpecs();
      setSpecs(specsList);
    } catch {
      toast.error("Failed to load API specifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { specs, setSpecs, loading, refresh };
}
