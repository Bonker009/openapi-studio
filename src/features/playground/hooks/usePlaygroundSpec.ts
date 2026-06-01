"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchData } from "@/lib/data-service";
import { buildWorkingPathSet } from "@/src/shared/utils/endpoint-key";

export type PlaygroundSpecData = {
  info?: { title?: string; version?: string };
  paths?: Record<string, unknown>;
  security?: unknown[];
  servers?: { url: string; description?: string }[];
  components?: unknown;
};

export function usePlaygroundSpec(specId: string) {
  const [apiData, setApiData] = useState<PlaygroundSpecData | null>(null);
  const [workingPaths, setWorkingPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const spec = (await fetchData("spec", specId)) as PlaygroundSpecData | null;
      if (!spec) {
        setError(`API specification '${specId}' not found`);
        setApiData(null);
        return;
      }
      setApiData(spec);
      try {
        const statuses = (await fetchData("status", specId)) as Array<{
          method: string;
          path: string;
          working?: boolean;
        }>;
        setWorkingPaths(buildWorkingPathSet(statuses ?? []));
      } catch {
        setWorkingPaths(new Set());
      }
    } catch {
      setError("Failed to load specification");
      setApiData(null);
    } finally {
      setLoading(false);
    }
  }, [specId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { apiData, workingPaths, loading, error, refresh: load };
}
