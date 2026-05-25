"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlaygroundShell } from "@/components/playground/playground-shell";
import { getApiSpectorConfig } from "@/apispector-config";
import { resolveDefaultBaseUrl } from "@/lib/playground/resolve-base-url";
import { SpecProvider, useSpecContext } from "@/spec-context";

function PlaygroundApp() {
  const { specId, apiData } = useSpecContext();
  const config = getApiSpectorConfig();
  const defaultBase = resolveDefaultBaseUrl({
    configuredUrl: config.defaultEnvironment?.url,
    servers: apiData.servers,
  });

  return (
    <PlaygroundShell
      specId={specId}
      specTitle={apiData.info?.title ?? "API"}
      specVersion={apiData.info?.version}
      apiData={{
        paths: apiData.paths,
        components: apiData.components,
        servers: apiData.servers,
        security: apiData.security,
      }}
      initialBaseUrl={defaultBase}
      embedded
    />
  );
}

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <SpecProvider>
          <div className="flex h-full min-h-screen flex-col">
            <PlaygroundApp />
          </div>
        </SpecProvider>
        <Toaster richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
