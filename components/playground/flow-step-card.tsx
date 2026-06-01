"use client";

import { useMemo, useState } from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { MethodBadge } from "@/components/method-badge";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JsonBodyEditorLazy } from "@/components/playground/json-body-editor-lazy";
import type { Credential } from "@/lib/playground/credentials";
import type { OpenApiParameter, PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { getRequestBodyInfo } from "@/lib/playground/request-body";
import { flowEndpointKey } from "@/lib/flows/types";
import { stepRoleLabel } from "@/lib/flows/auth-helpers";
import type {
  Extraction,
  FlowAuth,
  FlowStep,
  StepRunResult,
} from "@/lib/flows/types";
import {
  defaultFlowStepBody,
  getEndpointMethodData,
  mergeStepFields,
  methodSupportsOptionalBody,
  type FlowApiData,
} from "@/lib/flows/step-defaults";
import { getStepPayload } from "@/lib/flows/payload-tree";
import { getByPath } from "@/lib/flows/resolve-refs";
import {
  PayloadPicker,
  PayloadTreeView,
} from "@/components/playground/payload-picker";
import { cn } from "@/lib/utils";

/** Shared context the pickers need to resolve a prior step's payload. */
export type RefContext = {
  priorSteps: FlowStep[];
  endpoints: PlaygroundEndpoint[];
  apiData: FlowApiData;
  baseUrl: string;
  resultsByStepId?: Map<string, StepRunResult>;
};

type FlowStepCardProps = {
  step: FlowStep;
  index: number;
  endpoints: PlaygroundEndpoint[];
  apiData: FlowApiData;
  baseUrl: string;
  priorSteps: FlowStep[];
  credentials: Credential[];
  flowAuth?: FlowAuth;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  runResult?: StepRunResult;
  isRunning?: boolean;
  resultsByStepId?: Map<string, StepRunResult>;
  onChange: (step: FlowStep) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFocus?: () => void;
  onSetAsLogin?: () => void;
  /** Chromeless body for diagram inspector sheet (no card header/actions). */
  embedded?: boolean;
};

function referenceOptions(priorSteps: FlowStep[]): { label: string; token: string }[] {
  const opts: { label: string; token: string }[] = [];
  priorSteps.forEach((s, i) => {
    for (const ex of s.extractions) {
      if (ex.name.trim()) {
        opts.push({
          label: `Step ${i + 1} capture: ${ex.name}`,
          token: `{{vars.${ex.name.trim()}}}`,
        });
      }
    }
    opts.push({
      label: `Step ${i + 1} status`,
      token: `{{steps.${i}.status}}`,
    });
    opts.push({
      label: `Step ${i + 1} body (root)`,
      token: `{{steps.${i}.body}}`,
    });
  });
  return opts;
}

function StatusDot({
  runResult,
  isRunning,
}: {
  runResult?: StepRunResult;
  isRunning?: boolean;
}) {
  if (isRunning) {
    return (
      <Loader2
        className="h-3.5 w-3.5 shrink-0 animate-spin text-primary"
        aria-label="Running"
      />
    );
  }
  if (!runResult) return null;
  const tone =
    runResult.outcome === "pass"
      ? "bg-success"
      : runResult.outcome === "fail"
        ? "bg-amber-500"
        : runResult.outcome === "error"
          ? "bg-destructive"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full", tone)}
      title={runResult.outcome}
      aria-label={runResult.outcome}
    />
  );
}

/** Suggest a capture variable name from a path, e.g. "data[0].id" -> "id". */
function suggestVarName(path: string): string {
  const last = path.split(".").pop() ?? "";
  const cleaned = last.replace(/\[\d+\]/g, "");
  return cleaned || "value";
}

/** Short, single-line preview of a resolved capture value. */
function previewCaptureValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  }
  try {
    const s = JSON.stringify(value);
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  } catch {
    return String(value);
  }
}

/**
 * Resolve what a capture would extract from the last run response. Mirrors the
 * runner logic in run-flow.ts (body via getByPath, status, case-insensitive
 * headers) so the editor preview matches exactly what a run will capture.
 */
function resolveCapturePreview(
  ex: Extraction,
  runResult: StepRunResult | undefined
): { found: boolean; value: unknown } | null {
  if (!runResult) return null;
  if (ex.source === "status") {
    return { found: true, value: runResult.status };
  }
  if (ex.source === "headers") {
    const headers = (runResult as { headers?: Record<string, string> }).headers;
    if (!headers) return null;
    const key = Object.keys(headers).find(
      (k) => k.toLowerCase() === ex.path.trim().toLowerCase()
    );
    return key
      ? { found: true, value: headers[key] }
      : { found: false, value: undefined };
  }
  if (runResult.responseBody === undefined) return null;
  const value = getByPath(runResult.responseBody, ex.path);
  return { found: value !== undefined, value };
}

function RefPickerButton({
  refs,
  onPick,
  refContext,
}: {
  refs: { label: string; token: string }[];
  onPick: (token: string) => void;
  refContext?: RefContext;
}) {
  const [open, setOpen] = useState(false);
  const [payloadStepIdx, setPayloadStepIdx] = useState<number | null>(null);

  const priorSteps = refContext?.priorSteps ?? [];
  const hasPayloadPicking = priorSteps.length > 0 && !!refContext;
  if (refs.length === 0 && !hasPayloadPicking) return null;

  const selectedStep =
    payloadStepIdx != null ? priorSteps[payloadStepIdx] : undefined;
  const selectedEndpoint =
    selectedStep && refContext
      ? refContext.endpoints.find(
          (e) => flowEndpointKey(e) === selectedStep.endpointKey
        )
      : undefined;
  const payload =
    selectedStep && refContext
      ? getStepPayload(
          selectedEndpoint,
          refContext.apiData,
          refContext.baseUrl,
          refContext.resultsByStepId?.get(selectedStep.id)
        )
      : null;

  const insert = (token: string) => {
    onPick(token);
    setOpen(false);
    setPayloadStepIdx(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPayloadStepIdx(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title="Insert reference"
          aria-label="Insert reference"
          onClick={(e) => e.stopPropagation()}
        >
          <Braces className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        {payloadStepIdx == null ? (
          <div className="max-h-72 overflow-auto p-1">
            {refs.map((r) => (
              <button
                key={r.token}
                type="button"
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted font-mono"
                onClick={() => insert(r.token)}
              >
                {r.label}
              </button>
            ))}
            {hasPayloadPicking && (
              <div className="mt-1 border-t border-border pt-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  From a step&apos;s response
                </p>
                {priorSteps.map((s, i) => {
                  const ep = refContext?.endpoints.find(
                    (e) => flowEndpointKey(e) === s.endpointKey
                  );
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                      onClick={() => setPayloadStepIdx(i)}
                    >
                      <span className="text-muted-foreground tabular-nums">
                        Step {i + 1}
                      </span>{" "}
                      <span className="font-mono">{ep?.path ?? s.endpointKey}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1 border-b border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
              onClick={() => setPayloadStepIdx(null)}
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
              Back to references
            </button>
            {payload && (
              <PayloadTreeView
                body={payload.body}
                source={payload.source}
                title={`Step ${payloadStepIdx + 1} response`}
                onPick={(path) =>
                  insert(
                    path
                      ? `{{steps.${payloadStepIdx}.body.${path}}}`
                      : `{{steps.${payloadStepIdx}.body}}`
                  )
                }
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ParamField({
  param,
  value,
  onUpdate,
  refs,
  refContext,
}: {
  param: OpenApiParameter;
  value: string;
  onUpdate: (v: string) => void;
  refs: { label: string; token: string }[];
  refContext?: RefContext;
}) {
  const appendToken = (token: string) => {
    onUpdate(value ? `${value}${value.endsWith(" ") ? "" : " "}${token}` : token);
  };

  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center gap-1 min-w-0">
        <Label className="text-[10px] truncate flex-1">
          {param.in}/{param.name}
          {param.required && " *"}
        </Label>
        <RefPickerButton refs={refs} onPick={appendToken} refContext={refContext} />
      </div>
      <Input
        className="h-7 text-xs font-mono"
        value={value}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder={
          param.schema?.default != null
            ? String(param.schema.default)
            : param.schema?.enum?.[0]
              ? String(param.schema.enum[0])
              : undefined
        }
      />
    </div>
  );
}

function paramPreviewChips(
  params: OpenApiParameter[],
  values: Record<string, string>,
  max = 3
): { key: string; value: string }[] {
  const chips: { key: string; value: string }[] = [];
  for (const p of params) {
    const v = values[p.name]?.trim();
    if (!v) continue;
    chips.push({ key: p.name, value: v.length > 12 ? `${v.slice(0, 12)}…` : v });
    if (chips.length >= max) break;
  }
  return chips;
}

export function FlowStepCard({
  step,
  index,
  endpoints,
  apiData,
  baseUrl,
  priorSteps,
  credentials,
  flowAuth,
  open,
  onOpenChange,
  selected,
  canMoveUp,
  canMoveDown,
  runResult,
  isRunning,
  resultsByStepId,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onFocus,
  onSetAsLogin,
  embedded = false,
}: FlowStepCardProps) {
  const endpoint = endpoints.find((e) => flowEndpointKey(e) === step.endpointKey);
  const refs = useMemo(() => referenceOptions(priorSteps), [priorSteps]);

  const refContext = useMemo<RefContext>(
    () => ({ priorSteps, endpoints, apiData, baseUrl, resultsByStepId }),
    [priorSteps, endpoints, apiData, baseUrl, resultsByStepId]
  );

  const ownPayload = useMemo(
    () => getStepPayload(endpoint, apiData, baseUrl, runResult),
    [endpoint, apiData, baseUrl, runResult]
  );

  const merged = useMemo(
    () =>
      endpoint
        ? mergeStepFields(step, endpoint)
        : { paramValues: step.paramValues, headerValues: step.headerValues },
    [step, endpoint]
  );

  const paramValues = { ...merged.paramValues, ...step.paramValues };
  const headerValues = { ...merged.headerValues, ...step.headerValues };

  const pathParams = endpoint?.parameters.filter((p) => p.in === "path") ?? [];
  const queryParams = endpoint?.parameters.filter((p) => p.in === "query") ?? [];
  const headerParams = endpoint?.parameters.filter((p) => p.in === "header") ?? [];
  const cookieParams = endpoint?.parameters.filter((p) => p.in === "cookie") ?? [];

  const methodData = useMemo(
    () => (endpoint ? getEndpointMethodData(endpoint, apiData) : null),
    [endpoint, apiData]
  );

  const bodyInfo = useMemo(
    () => getRequestBodyInfo(methodData, apiData.components),
    [methodData, apiData.components]
  );

  const showBody =
    endpoint &&
    (endpoint.hasRequestBody ||
      bodyInfo.kind !== "none" ||
      methodSupportsOptionalBody(endpoint.method));

  const bodyIsJson = bodyInfo.kind === "json" || bodyInfo.kind === "none";

  const previewParams = useMemo(
    () =>
      paramPreviewChips(
        [...pathParams, ...queryParams],
        paramValues
      ),
    [pathParams, queryParams, paramValues]
  );

  const captureCount = step.extractions.filter((e) => e.name.trim()).length;
  const {
    label: roleLabel,
    isLogin: isLoginStep,
    usesLoginToken,
  } = useMemo(
    () => stepRoleLabel(step, flowAuth),
    [step, flowAuth]
  );

  const updateParam = (name: string, value: string) => {
    onChange({
      ...step,
      paramValues: { ...merged.paramValues, [name]: value },
    });
  };

  const updateHeader = (name: string, value: string) => {
    onChange({
      ...step,
      headerValues: { ...merged.headerValues, [name]: value },
    });
  };

  const fillSampleBody = () => {
    if (!endpoint) return;
    const sample = defaultFlowStepBody(endpoint, apiData, baseUrl);
    onChange({ ...step, body: sample ?? "{}" });
  };

  const updateExtraction = (idx: number, patch: Partial<Extraction>) => {
    const extractions = step.extractions.map((ex, i) =>
      i === idx ? { ...ex, ...patch } : ex
    );
    onChange({ ...step, extractions });
  };

  const addExtraction = () => {
    onChange({
      ...step,
      extractions: [
        ...step.extractions,
        { name: "", source: "body", path: "payload[0].id" },
      ],
    });
  };

  const removeExtraction = (idx: number) => {
    onChange({
      ...step,
      extractions: step.extractions.filter((_, i) => i !== idx),
    });
  };

  const allParams = [
    ...pathParams,
    ...queryParams,
    ...cookieParams,
    ...headerParams,
  ];

  const fieldBody = (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 gap-3",
        embedded ? "pt-0" : "pt-3"
      )}
    >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <Label className="text-[10px]">Run as</Label>
              {!embedded && onSetAsLogin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-[9px] text-primary"
                  onClick={onSetAsLogin}
                  title="Use this step's captured token for downstream Flow-default auth"
                >
                  <KeyRound className="h-3 w-3" />
                  Use as login
                </Button>
              )}
            </div>
            <Select
              value={
                step.credentialName === "No auth"
                  ? "__none__"
                  : step.credentialName ?? "__default__"
              }
              onValueChange={(v) =>
                onChange({
                  ...step,
                  credentialName:
                    v === "__default__"
                      ? undefined
                      : v === "__none__"
                        ? "No auth"
                        : v,
                })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Flow default</SelectItem>
                <SelectItem value="__none__">No auth</SelectItem>
                {credentials.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Expected status</Label>
            <Input
              className="h-7 text-xs"
              type="number"
              placeholder="Any 2xx–3xx"
              value={step.expectedStatus ?? ""}
              onChange={(e) =>
                onChange({
                  ...step,
                  expectedStatus: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </div>

          {allParams.length > 0 && (
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-border/50 bg-muted/15 p-2">
              {pathParams.map((p) => (
                <ParamField
                  key={`${p.in}-${p.name}`}
                  param={p}
                  value={paramValues[p.name] ?? ""}
                  onUpdate={(v) => updateParam(p.name, v)}
                  refs={refs}
                  refContext={refContext}
                />
              ))}
              {queryParams.map((p) => (
                <ParamField
                  key={`${p.in}-${p.name}`}
                  param={p}
                  value={paramValues[p.name] ?? ""}
                  onUpdate={(v) => updateParam(p.name, v)}
                  refs={refs}
                  refContext={refContext}
                />
              ))}
              {cookieParams.map((p) => (
                <ParamField
                  key={`${p.in}-${p.name}`}
                  param={p}
                  value={paramValues[p.name] ?? ""}
                  onUpdate={(v) => updateParam(p.name, v)}
                  refs={refs}
                  refContext={refContext}
                />
              ))}
              {headerParams.map((p) => (
                <ParamField
                  key={`${p.in}-${p.name}`}
                  param={p}
                  value={headerValues[p.name] ?? ""}
                  onUpdate={(v) => updateHeader(p.name, v)}
                  refs={refs}
                  refContext={refContext}
                />
              ))}
            </div>
          )}

          {showBody && (
            <div className="sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[10px]">
                  Request body
                  {bodyInfo.contentType ? (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({bodyInfo.contentType})
                    </span>
                  ) : null}
                </Label>
                <div className="flex items-center gap-1">
                  {endpoint?.hasRequestBody && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={fillSampleBody}
                    >
                      Fill sample
                    </Button>
                  )}
                  <RefPickerButton
                    refs={refs}
                    refContext={refContext}
                    onPick={(token) =>
                      onChange({
                        ...step,
                        body: step.body
                          ? `${step.body}${step.body.endsWith(" ") ? "" : " "}${token}`
                          : token,
                      })
                    }
                  />
                </div>
              </div>
              {bodyIsJson ? (
                <JsonBodyEditorLazy
                  value={step.body ?? "{}"}
                  onChange={(v) => onChange({ ...step, body: v })}
                  minHeight="100px"
                />
              ) : (
                <>
                  <Textarea
                    value={step.body ?? ""}
                    onChange={(e) => onChange({ ...step, body: e.target.value })}
                    rows={3}
                    className="text-xs font-mono resize-y"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Flow runs send JSON bodies only.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="sm:col-span-2 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5">
            <Checkbox
              id={`pause-${step.id}`}
              checked={!!step.pauseAfter}
              onCheckedChange={(c) =>
                onChange({ ...step, pauseAfter: c === true })
              }
            />
            <div className="min-w-0">
              <Label
                htmlFor={`pause-${step.id}`}
                className="text-[11px] font-medium cursor-pointer"
              >
                Pause after this step
              </Label>
              <p className="text-[9px] text-muted-foreground">
                Stop the run here to inspect the live response and capture fields
                before continuing.
              </p>
            </div>
          </div>

          <fieldset className="sm:col-span-2 space-y-2 min-w-0 border-0 p-0 m-0">
            <div className="flex items-center justify-between">
              <legend className="text-[10px] font-medium">Captures</legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 text-[10px] px-2"
                onClick={addExtraction}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            {step.extractions.length === 0 && (
              <p className="text-[10px] text-muted-foreground">
                e.g. <code className="font-mono">payload[0].generationId</code> →{" "}
                <code className="font-mono">productId</code>
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {step.extractions.map((ex, i) => {
                const preview = resolveCapturePreview(ex, runResult);
                return (
                <div
                  key={i}
                  className="flex flex-wrap gap-1.5 items-end sm:col-span-2"
                >
                  <div className="flex-1 min-w-[72px] space-y-0.5">
                    <Label
                      htmlFor={`cap-name-${step.id}-${i}`}
                      className="text-[9px] text-muted-foreground"
                    >
                      Variable name
                    </Label>
                    <Input
                      id={`cap-name-${step.id}-${i}`}
                      className="h-7 text-xs"
                      placeholder="name"
                      value={ex.name}
                      onChange={(e) =>
                        updateExtraction(i, { name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={`cap-source-${step.id}-${i}`}
                      className="text-[9px] text-muted-foreground"
                    >
                      Source
                    </Label>
                    <Select
                      value={ex.source}
                      onValueChange={(v) =>
                        updateExtraction(i, {
                          source: v as Extraction["source"],
                        })
                      }
                    >
                      <SelectTrigger
                        id={`cap-source-${step.id}-${i}`}
                        className="h-7 w-[88px] text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="body">body</SelectItem>
                        <SelectItem value="headers">headers</SelectItem>
                        <SelectItem value="status">status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {ex.source !== "status" && (
                    <div className="flex-[2] min-w-[100px] space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <Label
                          htmlFor={`cap-path-${step.id}-${i}`}
                          className="text-[9px] text-muted-foreground"
                        >
                          Path
                        </Label>
                        {ex.source === "body" && (
                          <PayloadPicker
                            body={ownPayload.body}
                            source={ownPayload.source}
                            title="Pick from response"
                            onPick={(path) =>
                              updateExtraction(i, {
                                path,
                                name: ex.name.trim()
                                  ? ex.name
                                  : suggestVarName(path),
                              })
                            }
                            trigger={
                              <button
                                type="button"
                                className="inline-flex items-center gap-0.5 text-[9px] text-info hover:underline"
                                title="Pick a field from this step's response"
                              >
                                <Braces className="h-2.5 w-2.5" />
                                Pick
                              </button>
                            }
                          />
                        )}
                      </div>
                      <Input
                        id={`cap-path-${step.id}-${i}`}
                        className="h-7 text-xs font-mono"
                        placeholder="payload[0].generationId"
                        value={ex.path}
                        onChange={(e) =>
                          updateExtraction(i, { path: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Remove capture ${ex.name || i + 1}`}
                    onClick={() => removeExtraction(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {preview && (
                    <p
                      className={cn(
                        "basis-full w-full min-w-0 truncate font-mono text-[9px]",
                        preview.found
                          ? "text-success"
                          : "text-destructive"
                      )}
                      title={
                        preview.found
                          ? previewCaptureValue(preview.value)
                          : `Not found in last response at: ${ex.path}`
                      }
                    >
                      {preview.found ? (
                        <>→ {previewCaptureValue(preview.value)}</>
                      ) : (
                        <>not found in last response</>
                      )}
                    </p>
                  )}
                </div>
                );
              })}
            </div>
          </fieldset>
        </div>
  );

  if (embedded) {
    return (
      <div id={`flow-step-${step.id}`} className="min-w-0">
        {fieldBody}
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      id={`flow-step-${step.id}`}
      className={cn(
        "scroll-mt-4 rounded-lg border border-border bg-card shadow-sm",
        selected && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center gap-1 px-2 py-2 min-h-[44px]">
        <CollapsibleTrigger
          className="flex flex-1 items-center gap-2 min-w-0 text-left hover:bg-muted/40 rounded-md px-1 py-0.5 -mx-1"
          onClick={onFocus}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {index + 1}
          </span>
          {endpoint ? (
            <>
              <MethodBadge method={endpoint.method} />
              <span className="text-xs font-mono truncate min-w-0">
                {endpoint.path}
              </span>
            </>
          ) : (
            <span className="text-xs text-destructive truncate">
              {step.endpointKey}
            </span>
          )}
          <StatusDot runResult={runResult} isRunning={isRunning} />
          {!open && (
            <div className="hidden sm:flex items-center gap-1 min-w-0 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[9px] h-5 px-1.5 shrink-0",
                  isLoginStep && "border-primary/40 bg-primary/10",
                  usesLoginToken && "border-success/40 bg-success/10"
                )}
              >
                {roleLabel}
              </Badge>
              {captureCount > 0 && (
                <Badge variant="outline" className="text-[9px] h-5 px-1.5 shrink-0">
                  {captureCount} cap
                </Badge>
              )}
              {previewParams.map((c) => (
                <Badge
                  key={c.key}
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 font-mono shrink-0 max-w-[100px] truncate"
                >
                  {c.key}={c.value}
                </Badge>
              ))}
            </div>
          )}
        </CollapsibleTrigger>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {onDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Duplicate step"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <CollapsibleContent className="px-3 pb-3 pt-0 border-t border-border/60">
        {fieldBody}
      </CollapsibleContent>
    </Collapsible>
  );
}
