"use client";

import { useEffect, useMemo, useState } from "react";
import { PlaygroundHeader } from "@/components/playground/playground-header";
import { EndpointList } from "@/components/playground/endpoint-list";
import { TryItPanel } from "@/components/playground/try-it-panel";
import {
  extractPlaygroundEndpoints,
  type PlaygroundEndpoint,
} from "@/lib/playground/endpoints";

type PlaygroundShellProps = {
  specId: string;
  specTitle: string;
  specVersion?: string;
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
    servers?: { url: string; description?: string }[];
    security?: unknown[];
  };
};

export function PlaygroundShell({
  specId,
  specTitle,
  specVersion,
  apiData,
}: PlaygroundShellProps) {
  const [baseUrl, setBaseUrl] = useState(
    apiData.servers?.[0]?.url?.replace(/\/$/, "") ?? "http://localhost:8080"
  );
  const [selected, setSelected] = useState<PlaygroundEndpoint | null>(null);
  const [activeTokenName, setActiveTokenName] = useState<string | null>(null);
  const [activeTokenValue, setActiveTokenValue] = useState<string | null>(null);

  const endpoints = useMemo(
    () =>
      extractPlaygroundEndpoints({
        paths: apiData.paths as Record<string, Record<string, unknown>> | undefined,
        security: apiData.security,
      }),
    [apiData.paths, apiData.security]
  );

  useEffect(() => {
    if (endpoints.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((prev) => {
      if (
        prev &&
        endpoints.some(
          (e) => e.method === prev.method && e.path === prev.path
        )
      ) {
        return prev;
      }
      return endpoints[0];
    });
  }, [endpoints]);

  const selectFirst = () => {
    const first = endpoints[0];
    if (first) setSelected(first);
  };

  return (
    <>
      <PlaygroundHeader
        specId={specId}
        specTitle={specTitle}
        specVersion={specVersion}
        specServers={apiData.servers}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        activeTokenName={activeTokenName}
        activeTokenValue={activeTokenValue}
        onActiveTokenChange={(name, value) => {
          setActiveTokenName(name);
          setActiveTokenValue(value);
        }}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-1/2 min-w-0 shrink-0 border-r border-border bg-card flex flex-col min-h-0">
          <EndpointList
            endpoints={endpoints}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="w-1/2 min-w-0 min-h-0 overflow-hidden bg-white flex flex-col">
          <TryItPanel
            endpoint={selected}
            apiData={apiData}
            baseUrl={baseUrl}
            activeTokenName={activeTokenName}
            activeTokenValue={activeTokenValue}
            totalEndpoints={endpoints.length}
            onSelectFirst={selectFirst}
          />
        </div>
      </div>
    </>
  );
}
