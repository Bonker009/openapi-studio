"use client";

import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Server,
  Shield,
  CheckCircle2,
  Layers,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ServerEntry = { url: string; description?: string };

type DocumentationSpecHeaderProps = {
  specId: string;
  title: string;
  version?: string;
  description?: string;
  servers?: ServerEntry[];
  authScheme?: string;
  totalEndpoints: number;
  workingEndpoints: number;
  onDownloadCsv: () => void;
  onSmokeTests?: () => void;
};

function formatVersion(version?: string) {
  if (!version || version === "unknown") return "N/A";
  const trimmed = version.trim();
  if (/^v/i.test(trimmed)) return trimmed;
  return `v${trimmed}`;
}

function StatTile({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground leading-none">
        {value}
      </p>
    </div>
  );
}

export function DocumentationSpecHeader({
  specId,
  title,
  version,
  description,
  servers = [],
  authScheme,
  totalEndpoints,
  workingEndpoints,
  onDownloadCsv,
  onSmokeTests,
}: DocumentationSpecHeaderProps) {
  return (
    <section className="mb-8 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="bg-gradient-to-br from-primary/8 via-card to-card px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Specification ·{" "}
              <span className="font-mono text-primary/90">{specId}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 gap-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              <Badge variant="info" className="tabular-nums text-sm px-2.5 py-0.5">
                {formatVersion(version)}
              </Badge>
              {authScheme && (
                <Badge variant="outline" className="gap-1.5 font-normal">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  {authScheme}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground max-w-5xl leading-relaxed">
                {description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {onSmokeTests && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-background/80"
                onClick={onSmokeTests}
              >
                <FlaskConical className="h-4 w-4" />
                Smoke tests
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-background/80"
              onClick={onDownloadCsv}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
          <StatTile
            label="Endpoints"
            value={totalEndpoints}
            icon={Layers}
            className="border-primary/15"
          />
          <StatTile
            label="Working"
            value={workingEndpoints}
            icon={CheckCircle2}
            className="border-success/30 bg-success/10"
          />
        </div>
      </div>

      {servers.length > 0 && (
        <>
          <Separator />
          <div className="px-6 py-4 sm:px-8 bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Servers</h2>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {servers.map((server, index) => (
                <li
                  key={`${server.url}-${index}`}
                  className="rounded-md border bg-background px-3 py-2.5 text-sm"
                >
                  <code className="text-xs font-mono text-primary break-all">
                    {server.url}
                  </code>
                  {server.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {server.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
