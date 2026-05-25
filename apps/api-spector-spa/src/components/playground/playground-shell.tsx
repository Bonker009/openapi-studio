"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDocExpansion,
  isDeepLinkingEnabled,
  isFilterEnabled,
  isPersistAuthorization,
} from "@/apispector-config";
import { PlaygroundHeader } from "@/components/playground/playground-header";
import { EndpointList } from "@/components/playground/endpoint-list";
import { TryItPanel } from "@/components/playground/try-it-panel";
import {
  extractPlaygroundEndpoints,
  type PlaygroundEndpoint,
} from "@/lib/playground/endpoints";
import {
  findEndpointByHash,
  syncHashFromEndpoint,
} from "@/lib/playground/deep-link";
import { clearCredentialsForSpec } from "@/lib/playground/credentials";
import { resolveDefaultBaseUrl } from "@/lib/playground/resolve-base-url";
import {
  credentialRequiresAuth,
  type Credential,
} from "@/lib/playground/credentials";

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
  workingPaths?: Set<string>;
  initialBaseUrl?: string;
  embedded?: boolean;
};

export function PlaygroundShell({
  specId,
  specTitle,
  specVersion,
  apiData,
  workingPaths,
  initialBaseUrl,
  embedded = false,
}: PlaygroundShellProps) {
  const [baseUrl, setBaseUrl] = useState(
    initialBaseUrl ??
      resolveDefaultBaseUrl({ servers: apiData.servers })
  );
  const [selected, setSelected] = useState<PlaygroundEndpoint | null>(null);
  const [activeCredential, setActiveCredential] = useState<Credential | null>(
    null
  );

  const endpoints = useMemo(
    () =>
      extractPlaygroundEndpoints({
        paths: apiData.paths as Record<string, Record<string, unknown>> | undefined,
        security: apiData.security,
      }),
    [apiData.paths, apiData.security]
  );

  const selectEndpoint = useCallback(
    (ep: PlaygroundEndpoint) => {
      setSelected(ep);
      syncHashFromEndpoint(ep, isDeepLinkingEnabled());
    },
    []
  );

  useEffect(() => {
    if (endpoints.length === 0) {
      setSelected(null);
      syncHashFromEndpoint(null, isDeepLinkingEnabled());
      return;
    }
    const fromHash = isDeepLinkingEnabled()
      ? findEndpointByHash(endpoints, window.location.hash)
      : null;
    if (fromHash) {
      setSelected(fromHash);
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
      const first = endpoints[0];
      syncHashFromEndpoint(first, isDeepLinkingEnabled());
      return first;
    });
  }, [endpoints]);

  useEffect(() => {
    if (!isDeepLinkingEnabled()) return;
    const onHashChange = () => {
      const ep = findEndpointByHash(endpoints, window.location.hash);
      if (ep) setSelected(ep);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [endpoints]);

  useEffect(() => {
    if (!isPersistAuthorization()) {
      const onUnload = () => clearCredentialsForSpec(specId);
      window.addEventListener("beforeunload", onUnload);
      return () => window.removeEventListener("beforeunload", onUnload);
    }
  }, [specId]);

  const selectFirst = () => {
    const first = endpoints[0];
    if (first) selectEndpoint(first);
  };

  const authSatisfied = credentialRequiresAuth(activeCredential);

  return (
    <>
      <PlaygroundHeader
        specId={specId}
        specTitle={specTitle}
        specVersion={specVersion}
        specServers={apiData.servers}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        activeCredential={activeCredential}
        onActiveCredentialChange={setActiveCredential}
        endpoints={endpoints}
        apiData={apiData}
        workingPaths={workingPaths}
        embedded={embedded}
      />

      <main id="main-content" className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-1/2 min-w-0 shrink-0 border-r border-border bg-card flex flex-col min-h-0">
          <EndpointList
            specId={specId}
            endpoints={endpoints}
            selected={selected}
            onSelect={selectEndpoint}
            authSatisfied={authSatisfied}
            showFilter={isFilterEnabled()}
            docExpansion={getDocExpansion()}
          />
        </div>
        <div className="w-1/2 min-w-0 min-h-0 overflow-hidden bg-card flex flex-col">
          <TryItPanel
            endpoint={selected}
            apiData={apiData}
            baseUrl={baseUrl}
            activeCredential={activeCredential}
            totalEndpoints={endpoints.length}
            onSelectFirst={selectFirst}
          />
        </div>
      </main>
    </>
  );
}
