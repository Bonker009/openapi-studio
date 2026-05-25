"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { extractPlaygroundEndpoints } from "@/lib/playground/endpoints";
import { getApiSpectorConfig } from "@/apispector-config";

export type ApiData = {
  paths?: Record<string, unknown>;
  components?: unknown;
  servers?: { url: string; description?: string }[];
  security?: unknown[];
  info?: { title?: string; version?: string; description?: string };
};

type SpecContextValue = {
  specId: string;
  apiData: ApiData;
  loading: boolean;
  error: string | null;
};

const SpecContext = createContext<SpecContextValue | null>(null);

export function useSpecContext(): SpecContextValue {
  const ctx = useContext(SpecContext);
  if (!ctx) throw new Error("useSpecContext must be used within SpecProvider");
  return ctx;
}

export function usePlaygroundEndpoints() {
  const { apiData } = useSpecContext();
  return useMemo(
    () =>
      extractPlaygroundEndpoints({
        paths: apiData.paths as
          | Record<string, Record<string, unknown>>
          | undefined,
        security: apiData.security,
      }),
    [apiData]
  );
}

export function SpecProvider({ children }: { children: ReactNode }) {
  const config = getApiSpectorConfig();
  const [apiData, setApiData] = useState<ApiData | null>(
    config.spec ? (config.spec as ApiData) : null
  );
  const [loading, setLoading] = useState(Boolean(config.specUrl && !config.spec));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config.spec) {
      setApiData(config.spec as ApiData);
      setLoading(false);
      return;
    }
    if (!config.specUrl) {
      setError("Either specUrl or spec is required");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(config.specUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load spec (${res.status})`);
        return res.json() as Promise<ApiData>;
      })
      .then((data) => {
        if (!cancelled) {
          setApiData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config.spec, config.specUrl]);

  const specId = useMemo(
    () =>
      (apiData?.info?.title ?? "api")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "api",
    [apiData]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading API specification…
      </div>
    );
  }

  if (error || !apiData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
        {error ?? "No API specification available"}
      </div>
    );
  }

  return (
    <SpecContext.Provider value={{ specId, apiData, loading: false, error: null }}>
      {children}
    </SpecContext.Provider>
  );
}
