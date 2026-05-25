"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnvironmentSwitcher } from "@/components/playground/environment-switcher";
import { TokenPanel } from "@/components/playground/token-panel";
import { ExportMenu } from "@/components/playground/export-menu";
import { SmokeTestDialog } from "@/components/playground/smoke-test-dialog";
import type { Credential } from "@/lib/playground/credentials";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";

function formatSpecVersion(version?: string): string | null {
  if (!version || version === "unknown") return null;
  const trimmed = version.trim();
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
}

type PlaygroundHeaderProps = {
  specId: string;
  specTitle: string;
  specVersion?: string;
  specServers?: { url: string; description?: string }[];
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  activeCredential: Credential | null;
  onActiveCredentialChange: (credential: Credential | null) => void;
  endpoints?: PlaygroundEndpoint[];
  apiData?: {
    paths?: Record<string, unknown>;
    components?: unknown;
  };
  workingPaths?: Set<string>;
  embedded?: boolean;
};

export function PlaygroundHeader({
  specId,
  specTitle,
  specVersion,
  specServers,
  baseUrl,
  onBaseUrlChange,
  activeCredential,
  onActiveCredentialChange,
  endpoints = [],
  apiData,
  workingPaths,
  embedded = false,
}: PlaygroundHeaderProps) {
  const [smokeOpen, setSmokeOpen] = useState(false);
  const versionLabel = formatSpecVersion(specVersion);

  return (
    <header className="shrink-0 z-20 bg-card border-b border-border">
      <div className="h-1 bg-primary w-full" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 shrink max-w-[min(100%,280px)] sm:max-w-md">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
            {embedded ? "api-spector" : "API Playground"}
          </p>
          <div className="flex flex-wrap items-center gap-2 min-w-0 mt-0.5">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate min-w-0">
              {specTitle}
            </h1>
            {versionLabel && (
              <Badge variant="info" className="tabular-nums text-[10px] shrink-0">
                {versionLabel}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 justify-end min-w-0">
          <EnvironmentSwitcher
            specId={specId}
            specServers={specServers}
            activeUrl={baseUrl}
            onActiveUrlChange={onBaseUrlChange}
            variant="navbar"
          />
          <div className="hidden sm:block h-6 w-px bg-border shrink-0" aria-hidden />
          <TokenPanel
            specId={specId}
            activeCredential={activeCredential}
            onActiveChange={onActiveCredentialChange}
            variant="navbar"
          />
          <ExportMenu
            specTitle={specTitle}
            specId={specId}
            baseUrl={baseUrl}
            endpoints={endpoints}
            apiData={apiData as Record<string, unknown>}
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 h-8 text-xs"
            onClick={() => setSmokeOpen(true)}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Smoke tests
          </Button>
          <SmokeTestDialog
            open={smokeOpen}
            onOpenChange={setSmokeOpen}
            specId={specId}
            baseUrl={baseUrl}
            credential={activeCredential}
            endpoints={endpoints}
            apiData={apiData ?? {}}
            workingPaths={workingPaths}
          />
        </div>
      </div>
    </header>
  );
}
