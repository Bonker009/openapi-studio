"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  ShieldCheck,
  Settings2,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ValidationEndpointOverridesGrid } from "@/components/playground/validation-endpoint-overrides-grid";
import {
  ValidationOverridesEditor,
  endpointEditorTitle,
  globalEditorTitle,
} from "@/components/playground/validation-overrides-editor";
import {
  ValidationResultsPanel,
  type ResultFilter,
} from "@/components/playground/validation-results-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  credentialRequiresAuth,
  type Credential,
} from "@/lib/playground/credentials";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import {
  getValidationConfig,
  getValidationOverridesStore,
  setValidationConfig,
  setValidationOverridesStore,
  type StoredValidationConfig,
} from "@/lib/playground/storage";
import { estimateValidationCaseCount } from "@/lib/validation/case-builder";
import { runValidationSuite } from "@/lib/validation/suite-runner";
import { validationAggregate } from "@/lib/validation/aggregate";
import { exportValidationResultsToExcel } from "@/lib/validation/export-results";
import { toast } from "sonner";
import { runValidationCase } from "@/lib/validation/case-runner";
import { buildEndpointValidationSuite } from "@/lib/validation/case-builder";
import { suggestOverrideKeysForEndpoint } from "@/lib/validation/overrides";
import {
  DEFAULT_VALIDATION_CONFIG,
  EMPTY_OVERRIDES_STORE,
  endpointKey,
  type OverrideMap,
  type PassPolicy,
  type ValidationOverridesStore,
  type ValidationResult,
  type ValidationSuiteConfig,
} from "@/lib/validation/types";
type ValidationTestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specId: string;
  endpoints: PlaygroundEndpoint[];
  workingPaths?: Set<string>;
  baseUrl: string;
  credential: Credential | null;
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
  };
};

function storedToConfig(stored: StoredValidationConfig | null): ValidationSuiteConfig {
  if (!stored) return { ...DEFAULT_VALIDATION_CONFIG };
  let passPolicy: PassPolicy = { kind: "4xx" };
  if (stored.passPolicyKind === "strict-400") passPolicy = { kind: "strict-400" };
  else if (stored.passPolicyKind === "4xx-or-422") passPolicy = { kind: "4xx-or-422" };
  else if (stored.passPolicyKind === "custom-range") {
    passPolicy = {
      kind: "custom-range",
      min: stored.passPolicyMin ?? 400,
      max: stored.passPolicyMax ?? 422,
    };
  }
  return {
    concurrency: stored.concurrency ?? DEFAULT_VALIDATION_CONFIG.concurrency,
    passPolicy,
    includeNoisyVariants:
      stored.includeNoisyVariants ?? DEFAULT_VALIDATION_CONFIG.includeNoisyVariants,
    perEndpointCap:
      stored.perEndpointCap ?? DEFAULT_VALIDATION_CONFIG.perEndpointCap,
  };
}

function configToStored(config: ValidationSuiteConfig): StoredValidationConfig {
  const base: StoredValidationConfig = {
    concurrency: config.concurrency,
    passPolicyKind: config.passPolicy.kind,
    includeNoisyVariants: config.includeNoisyVariants,
    perEndpointCap: config.perEndpointCap,
  };
  if (config.passPolicy.kind === "custom-range") {
    base.passPolicyMin = config.passPolicy.min;
    base.passPolicyMax = config.passPolicy.max;
  }
  return base;
}

function authLabel(credential: Credential | null): {
  text: string;
  variant: "default" | "secondary" | "outline" | "destructive";
} {
  if (!credential) {
    return {
      text: "No auth — protected endpoints may return 401",
      variant: "destructive",
    };
  }
  switch (credential.type) {
    case "bearer":
      return { text: `Auth: Bearer · ${credential.name}`, variant: "secondary" };
    case "basic":
      return { text: `Auth: Basic · ${credential.name}`, variant: "secondary" };
    case "apiKey":
      return {
        text: `Auth: API key (${credential.paramName}) · ${credential.name}`,
        variant: "secondary",
      };
    case "oauth2cc":
      return {
        text: `Auth: OAuth2 (client credentials) · ${credential.name}`,
        variant: "secondary",
      };
    case "oauth2rt":
      return {
        text: `Auth: OAuth2 (refresh token) · ${credential.name}`,
        variant: "secondary",
      };
  }
}

function ValidationExportMenu({
  results,
  specId,
  disabled,
}: {
  results: ValidationResult[];
  specId: string;
  disabled?: boolean;
}) {
  const [exporting, setExporting] = useState(false);

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    toast.success("Results copied as JSON");
  };

  const handleDownloadExcel = async () => {
    setExporting(true);
    const toastId = toast.loading("Building Excel workbook…");
    try {
      await exportValidationResultsToExcel(specId, results);
      toast.success("Excel file downloaded", { id: toastId });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to export Excel",
        { id: toastId }
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || exporting}>
          {exporting ? (
            <Loader2 className="size-4 mr-1.5 motion-safe:animate-spin" aria-hidden />
          ) : (
            <Download className="size-4 mr-1.5" aria-hidden />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handleCopyJson()}>
          <Copy className="size-4 mr-2" aria-hidden />
          Copy JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleDownloadExcel()}
          disabled={exporting}
        >
          <Download className="size-4 mr-2" aria-hidden />
          Download Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ValidationAuthChip({ credential }: { credential: Credential | null }) {
  const { text, variant } = authLabel(credential);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={variant}
          className="h-6 gap-1 px-2 text-[11px] font-normal max-w-full"
        >
          <KeyRound className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{text}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        Inherited from the playground token panel. Change credentials there before
        running validation.
      </TooltipContent>
    </Tooltip>
  );
}

function ValidationConfigPopover({
  config,
  onChange,
  disabled,
}: {
  config: ValidationSuiteConfig;
  onChange: (c: ValidationSuiteConfig) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={disabled}
          aria-label="Validation test settings"
        >
          <Settings2 className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Endpoint concurrency</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {config.concurrency}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={config.concurrency}
              onChange={(e) =>
                onChange({ ...config, concurrency: Number(e.target.value) })
              }
              className="w-full accent-primary"
            />
          </div>
          <div className="space-y-2">
            <Label>Pass policy</Label>
            <Select
              value={config.passPolicy.kind}
              onValueChange={(v) => {
                if (v === "strict-400") onChange({ ...config, passPolicy: { kind: "strict-400" } });
                else if (v === "4xx-or-422")
                  onChange({ ...config, passPolicy: { kind: "4xx-or-422" } });
                else if (v === "custom-range")
                  onChange({
                    ...config,
                    passPolicy: { kind: "custom-range", min: 400, max: 422 },
                  });
                else onChange({ ...config, passPolicy: { kind: "4xx" } });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4xx">Any 4xx = pass</SelectItem>
                <SelectItem value="strict-400">Only 400 = pass</SelectItem>
                <SelectItem value="4xx-or-422">4xx or 422 = pass</SelectItem>
                <SelectItem value="custom-range">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Per-endpoint cap</Label>
              <span className="text-sm tabular-nums">{config.perEndpointCap}</span>
            </div>
            <input
              type="range"
              min={20}
              max={200}
              step={10}
              value={config.perEndpointCap}
              onChange={(e) =>
                onChange({
                  ...config,
                  perEndpointCap: Number(e.target.value),
                })
              }
              className="w-full accent-primary"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ValidationTestDialog({
  open,
  onOpenChange,
  specId,
  endpoints,
  workingPaths = new Set(),
  baseUrl,
  credential,
  apiData,
}: ValidationTestDialogProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<"setup" | "results">("setup");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [store, setStore] = useState<ValidationOverridesStore>({
    ...EMPTY_OVERRIDES_STORE,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [config, setConfig] = useState<ValidationSuiteConfig>({
    ...DEFAULT_VALIDATION_CONFIG,
  });
  const [estimate, setEstimate] = useState({
    totalCases: 0,
    endpointCount: 0,
    skippedCount: 0,
  });
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const persistStoreRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estimateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const loaded = getValidationOverridesStore(specId);
    setStore(loaded);
    setConfig(storedToConfig(getValidationConfig(specId)));
  }, [open, specId]);

  const targetEndpoints = useMemo(() => {
    if (workingPaths.size === 0) return endpoints;
    return endpoints.filter((ep) =>
      workingPaths.has(`${ep.method.toUpperCase()}:${ep.path}`)
    );
  }, [endpoints, workingPaths]);

  useEffect(() => {
    if (!open || targetEndpoints.length === 0) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => {
      if (prev && targetEndpoints.some((ep) => endpointKey(ep) === prev)) {
        return prev;
      }
      return endpointKey(targetEndpoints[0]);
    });
  }, [open, targetEndpoints]);

  const endpointByKey = useMemo(() => {
    const m = new Map<string, PlaygroundEndpoint>();
    for (const ep of targetEndpoints) {
      m.set(endpointKey(ep), ep);
    }
    return m;
  }, [targetEndpoints]);

  const selectedEndpoint = selectedKey
    ? endpointByKey.get(selectedKey) ?? null
    : null;

  const authSatisfied = credentialRequiresAuth(credential);

  const schedulePersistStore = useCallback(
    (updater: (prev: ValidationOverridesStore) => ValidationOverridesStore) => {
      setStore((prev) => {
        const next = updater(prev);
        if (persistStoreRef.current) clearTimeout(persistStoreRef.current);
        persistStoreRef.current = setTimeout(() => {
          setValidationOverridesStore(specId, next);
        }, 300);
        return next;
      });
    },
    [specId]
  );

  useEffect(() => {
    if (!open) return;
    if (estimateRef.current) clearTimeout(estimateRef.current);
    estimateRef.current = setTimeout(() => {
      setEstimate(
        estimateValidationCaseCount(targetEndpoints, apiData, store, config)
      );
    }, 500);
    return () => {
      if (estimateRef.current) clearTimeout(estimateRef.current);
    };
  }, [open, targetEndpoints, apiData, store, config]);

  useEffect(() => {
    return () => {
      if (persistStoreRef.current) clearTimeout(persistStoreRef.current);
    };
  }, []);

  const aggregate = useMemo(() => validationAggregate(results), [results]);

  const persistConfig = useCallback(
    (next: ValidationSuiteConfig) => {
      setConfig(next);
      setValidationConfig(specId, configToStored(next));
    },
    [specId]
  );

  const updateGlobal = useCallback(
    (map: OverrideMap) => {
      schedulePersistStore((prev) => ({ ...prev, global: map }));
    },
    [schedulePersistStore]
  );

  const updateEndpointOverrides = useCallback(
    (key: string, map: OverrideMap) => {
      schedulePersistStore((prev) => ({
        ...prev,
        byEndpoint: { ...prev.byEndpoint, [key]: map },
      }));
    },
    [schedulePersistStore]
  );

  const copyToAllEndpoints = useCallback(() => {
    if (!selectedKey) return;
    schedulePersistStore((prev) => {
      const source = prev.byEndpoint[selectedKey] ?? prev.global;
      const nextByEndpoint: Record<string, OverrideMap> = {};
      for (const ep of targetEndpoints) {
        nextByEndpoint[endpointKey(ep)] = { ...source };
      }
      return { ...prev, byEndpoint: nextByEndpoint };
    });
  }, [selectedKey, targetEndpoints, schedulePersistStore]);

  const clearEndpointOverrides = useCallback(() => {
    if (!selectedKey) return;
    schedulePersistStore((prev) => {
      const next = { ...prev.byEndpoint };
      delete next[selectedKey];
      return { ...prev, byEndpoint: next };
    });
  }, [selectedKey, schedulePersistStore]);

  const run = useCallback(async () => {
    if (targetEndpoints.length === 0) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setResults([]);
    setExpandedKeys(new Set());
    setActiveTab("results");
    setResultFilter("all");
    setProgress({ done: 0, total: targetEndpoints.length });

    try {
      const summary = await runValidationSuite({
        specId,
        endpoints: targetEndpoints,
        baseUrl,
        credential,
        apiData,
        overrides: store,
        config,
        signal: ac.signal,
        onProgress: (done, total, latest) => {
          setProgress({ done, total });
          if (latest) {
            setResults((prev) => {
              const idx = prev.findIndex((r) => r.caseId === latest.caseId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = latest;
                return next;
              }
              return [...prev, latest];
            });
          }
        },
      });
      setResults(summary.results);
      setProgress({ done: summary.totalCases, total: summary.totalCases });
    } catch {
      /* aborted */
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [targetEndpoints, baseUrl, credential, apiData, store, config, specId]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const showEmpty = results.length === 0 && !running;

  const handleRerunCase = useCallback(
    async (r: ValidationResult, ep: PlaygroundEndpoint) => {
      const suite = buildEndpointValidationSuite(ep, apiData, store, config);
      const testCase = suite.cases.find((c) => c.id === r.caseId);
      if (!testCase) return;
      const one = await runValidationCase(testCase, {
        specId,
        baseUrl,
        credential,
        endpoint: ep,
        passPolicy: config.passPolicy,
        apiData,
      });
      setResults((prev) => {
        const idx = prev.findIndex((x) => x.caseId === r.caseId);
        if (idx < 0) return [...prev, one];
        const next = [...prev];
        next[idx] = one;
        return next;
      });
    },
    [apiData, store, config, baseUrl, credential, specId]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full max-h-full w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw]"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b bg-background px-4 pt-3 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <SheetHeader className="p-0">
                <SheetTitle className="text-sm font-semibold leading-none">
                  Validation tests
                </SheetTitle>
              </SheetHeader>
              <ValidationAuthChip credential={credential} />
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void run()}
                  disabled={running || targetEndpoints.length === 0}
                >
                  {running ? "Running…" : "Run"}
                </Button>
                {running ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={stop}
                  >
                    Stop
                  </Button>
                ) : null}
                <ValidationConfigPopover
                  config={config}
                  onChange={persistConfig}
                  disabled={running}
                />
              </div>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "setup" | "results")}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="shrink-0 px-4 pt-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <TabsList className="h-8 w-auto gap-1 rounded-lg bg-muted/60 p-0.5">
                  <TabsTrigger
                    value="setup"
                    className="h-6 rounded-md px-3 text-[11px] font-medium text-muted-foreground shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    Setup
                  </TabsTrigger>
                  <TabsTrigger
                    value="results"
                    className="h-6 rounded-md px-3 text-[11px] font-medium text-muted-foreground shadow-none gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    Results
                    {results.length > 0 ? (
                      <Badge
                        variant={
                          aggregate.failed + aggregate.errors > 0
                            ? "destructive"
                            : "secondary"
                        }
                        className="h-4 px-1 text-[10px] tabular-nums gap-0.5"
                      >
                        {aggregate.failed + aggregate.errors > 0 ? (
                          <>
                            <XCircle className="size-2.5" aria-hidden />
                            {aggregate.failed + aggregate.errors}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-2.5" aria-hidden />
                            {aggregate.passed}
                          </>
                        )}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
                {(running || progress.total > 0) && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {progress.done}/{progress.total}
                    {progress.total > 0
                      ? ` · ${Math.round((progress.done / progress.total) * 100)}%`
                      : ""}
                  </span>
                )}
              </div>
              {(running || progress.total > 0) && (
                <Progress
                  value={
                    progress.total > 0
                      ? (progress.done / progress.total) * 100
                      : 0
                  }
                  className="h-0.5"
                />
              )}
            </div>
            <TabsContent
              value="setup"
              className="mt-0 flex-1 min-h-0 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden"
            >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4 min-h-0">
              <div className="min-h-0 flex flex-col border rounded-md p-3 bg-muted/20">
                <p className="text-xs font-medium mb-2">Endpoints</p>
                <ValidationEndpointOverridesGrid
                  endpoints={targetEndpoints}
                  store={store}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                  authSatisfied={authSatisfied}
                  disabled={running}
                />
              </div>
              <div className="min-h-0 flex flex-col gap-4 overflow-y-auto max-h-[min(55vh,480px)]">
                <div className="border rounded-md p-3 bg-background">
                  <ValidationOverridesEditor
                    title={globalEditorTitle()}
                    description="Applied to every endpoint unless overridden below."
                    overrides={store.global}
                    onChange={updateGlobal}
                    disabled={running}
                  />
                </div>
                {selectedEndpoint ? (
                  <div className="border rounded-md p-3 bg-background">
                    <ValidationOverridesEditor
                      title={endpointEditorTitle(selectedEndpoint)}
                      description="Overrides for this endpoint only (merged on top of global defaults)."
                      overrides={store.byEndpoint[selectedKey!] ?? {}}
                      onChange={(map) =>
                        updateEndpointOverrides(selectedKey!, map)
                      }
                      onAutoSuggest={() => {
                        const key = selectedKey!;
                        const suggested = suggestOverrideKeysForEndpoint(
                          apiData,
                          selectedEndpoint
                        );
                        schedulePersistStore((prev) => {
                          const current = prev.byEndpoint[key] ?? {};
                          const next = { ...current };
                          for (const field of suggested) {
                            if (!(field in next)) next[field] = "";
                          }
                          return {
                            ...prev,
                            byEndpoint: { ...prev.byEndpoint, [key]: next },
                          };
                        });
                      }}
                      disabled={running}
                    />
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={running}
                        onClick={copyToAllEndpoints}
                      >
                        Copy to all endpoints
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={running}
                        onClick={clearEndpointOverrides}
                      >
                        Clear endpoint
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-3 border rounded-md">
                    Select an endpoint to configure overrides.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Estimated{" "}
                <span className="font-medium text-foreground">
                  {estimate.totalCases}
                </span>{" "}
                cases · {estimate.endpointCount} endpoints
                {estimate.skippedCount > 0
                  ? ` · ${estimate.skippedCount} skipped`
                  : ""}
              </p>
              {results.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setActiveTab("results");
                    if (aggregate.failed > 0) setResultFilter("fail");
                  }}
                >
                  View results
                </Button>
              ) : null}
            </div>

            </TabsContent>

            <TabsContent
              value="results"
              className="mt-0 flex-1 min-h-0 flex flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              {showEmpty && !running ? (
                <div className="flex flex-1 items-center justify-center px-6 py-12">
                  <div className="max-w-md w-full rounded-lg border bg-muted/20 p-6 text-center space-y-4">
                    <ShieldCheck className="size-10 text-muted-foreground mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No results yet</p>
                      <p className="text-sm text-muted-foreground">
                        Configure auth and field overrides in Setup, then run validation.
                        Invalid inputs should return 4xx.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void run()}
                        disabled={targetEndpoints.length === 0}
                      >
                        Run validation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab("setup")}
                      >
                        Go to Setup
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
                  <ValidationResultsPanel
                    results={results}
                    running={running}
                    aggregate={aggregate}
                    filter={resultFilter}
                    onFilterChange={setResultFilter}
                    endpointByKey={endpointByKey}
                    specId={specId}
                    expandedKeys={expandedKeys}
                    onExpandedKeysChange={setExpandedKeys}
                    onRerunCase={handleRerunCase}
                  />
                </div>
              )}
              <div className="shrink-0 border-t px-6 py-3 bg-background flex items-center justify-end gap-2">
                <ValidationExportMenu
                  results={results}
                  specId={specId}
                  disabled={results.length === 0}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
