"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FlowStepCard } from "@/components/playground/flow-step-card";
import type { Credential } from "@/lib/playground/credentials";
import {
  groupEndpointsByController,
  type PlaygroundEndpoint,
} from "@/lib/playground/endpoints";
import {
  pickTokenVarFromStep,
  setFlowLoginStep,
} from "@/lib/flows/auth-helpers";
import {
  flowEndpointKey,
  type ConditionalOperator,
  MAX_FLOW_STEPS,
  newStepId,
  type Flow,
  type FlowAuth,
  type FlowStep,
  type StepRunResult,
} from "@/lib/flows/types";
import { MethodBadge } from "@/components/method-badge";
import { toast } from "sonner";
import {
  createFlowStepFromEndpoint,
  type FlowApiData,
} from "@/lib/flows/step-defaults";
import { validateFlowSteps } from "@/lib/flows/validate-steps";
import { linearConnections, orderSteps } from "@/lib/flows/order";

type FlowBuilderProps = {
  flow: Flow;
  endpoints: PlaygroundEndpoint[];
  credentials: Credential[];
  apiData: FlowApiData;
  baseUrl: string;
  runResults?: StepRunResult[];
  runningIndex?: number | null;
  selectedStepId: string | null;
  focusStepId?: string | null;
  onSelectStep: (stepId: string | null) => void;
  onChange: (flow: Flow) => void;
};

export function FlowBuilder({
  flow,
  endpoints,
  credentials,
  apiData,
  baseUrl,
  runResults = [],
  runningIndex = null,
  selectedStepId,
  focusStepId,
  onSelectStep,
  onChange,
}: FlowBuilderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [collapsedControllers, setCollapsedControllers] = useState<Set<string>>(
    () => new Set()
  );
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [validationDismissed, setValidationDismissed] = useState(false);

  const groupedEndpoints = useMemo(
    () => groupEndpointsByController(endpoints),
    [endpoints]
  );
  const controllerNames = useMemo(
    () => Object.keys(groupedEndpoints).sort((a, b) => a.localeCompare(b)),
    [groupedEndpoints]
  );

  const toggleController = (controller: string) => {
    setCollapsedControllers((prev) => {
      const next = new Set(prev);
      if (next.has(controller)) next.delete(controller);
      else next.add(controller);
      return next;
    });
  };

  const validationIssues = useMemo(
    () => validateFlowSteps(flow, endpoints),
    [flow, endpoints]
  );

  const showValidation =
    validationIssues.length > 0 && !validationDismissed;

  const isStepOpen = (stepId: string) => !collapsedIds.has(stepId);

  const setStepOpen = (stepId: string, open: boolean) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (open) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const allCollapsed =
    flow.steps.length > 0 && flow.steps.every((s) => collapsedIds.has(s.id));

  const toggleCollapseAll = () => {
    setCollapsedIds(
      allCollapsed ? new Set() : new Set(flow.steps.map((s) => s.id))
    );
  };

  const updateStep = (index: number, step: FlowStep) => {
    const steps = [...flow.steps];
    steps[index] = step;
    onChange({ ...flow, steps });
    setValidationDismissed(false);
  };

  const removeStep = (index: number) => {
    const steps = flow.steps.filter((_, i) => i !== index);
    onChange({ ...flow, steps, connections: linearConnections(steps) });
    if (selectedStepId === flow.steps[index]?.id) onSelectStep(null);
  };

  const duplicateStep = (index: number) => {
    if (flow.steps.length >= MAX_FLOW_STEPS) return;
    const source = flow.steps[index];
    const copy: FlowStep = {
      ...source,
      id: newStepId(),
      paramValues: { ...source.paramValues },
      headerValues: { ...source.headerValues },
      extractions: source.extractions.map((e) => ({ ...e })),
    };
    const steps = [...flow.steps];
    steps.splice(index + 1, 0, copy);
    onChange({ ...flow, steps, connections: linearConnections(steps) });
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(copy.id);
      return next;
    });
    onSelectStep(copy.id);
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= flow.steps.length) return;
    const steps = [...flow.steps];
    [steps[index], steps[next]] = [steps[next], steps[index]];
    onChange({ ...flow, steps, connections: linearConnections(steps) });
  };

  const addStep = (endpoint: PlaygroundEndpoint) => {
    if (flow.steps.length >= MAX_FLOW_STEPS) return;
    const step = createFlowStepFromEndpoint(endpoint, apiData, baseUrl);
    const steps = [...flow.steps, step];
    onChange({ ...flow, steps, connections: linearConnections(steps) });
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(step.id);
      return next;
    });
    onSelectStep(step.id);
    setPickerOpen(false);
    setPickerSearch("");
    setValidationDismissed(false);
  };

  const addConditionalStep = () => {
    if (flow.steps.length >= MAX_FLOW_STEPS) return;
    const step: FlowStep = {
      id: newStepId(),
      name: "Condition",
      stepKind: "conditional",
      endpointKey: "CONDITION:branch",
      paramValues: {},
      headerValues: {},
      extractions: [],
      conditional: {
        left: "{{vars.value}}",
        operator: "equals",
        right: "true",
      },
    };
    const steps = [...flow.steps, step];
    onChange({ ...flow, steps, connections: linearConnections(steps) });
    onSelectStep(step.id);
    setValidationDismissed(false);
  };

  const resultByStepId = useMemo(() => {
    const m = new Map<string, StepRunResult>();
    for (const r of runResults) m.set(r.stepId, r);
    return m;
  }, [runResults]);

  // Display in execution order so the builder matches the wired run order.
  const orderedSteps = useMemo(() => orderSteps(flow), [flow]);

  const loginStep = flow.auth
    ? flow.steps.find((s) => s.id === flow.auth!.loginStepId)
    : undefined;

  const loginCaptureNames = useMemo(() => {
    if (!loginStep) return [];
    return loginStep.extractions
      .map((ex) => ex.name.trim())
      .filter(Boolean);
  }, [loginStep]);

  const setFlowAuthMode = (mode: "credential" | "login_token") => {
    if (mode === "credential") {
      onChange({ ...flow, auth: undefined });
      return;
    }
    const first = orderedSteps[0];
    if (!first) return;
    const { extractions, tokenVar } = pickTokenVarFromStep(first);
    const steps = flow.steps.map((s) =>
      s.id === first.id ? { ...s, extractions } : s
    );
    onChange({
      ...flow,
      steps,
      auth: { loginStepId: first.id, tokenVar, scheme: "bearer" },
    });
  };

  const updateFlowAuth = (patch: Partial<FlowAuth>) => {
    if (!flow.auth) return;
    onChange({ ...flow, auth: { ...flow.auth, ...patch } });
  };

  const setStepAsLogin = (stepId: string) => {
    onChange(setFlowLoginStep(flow, stepId));
    toast.success("This step is now the flow login");
  };

  useEffect(() => {
    if (!focusStepId) return;
    setStepOpen(focusStepId, true);
    onSelectStep(focusStepId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open step when parent requests focus
  }, [focusStepId]);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Flow name</Label>
          <Input
            value={flow.name}
            onChange={(e) => onChange({ ...flow, name: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={flow.description ?? ""}
            onChange={(e) => onChange({ ...flow, description: e.target.value })}
            rows={2}
            className="text-sm resize-none"
          />
        </div>
        <div className="space-y-1 max-w-xs">
          <Label className="text-xs">On step failure</Label>
          <Select
            value={flow.onStepFailure}
            onValueChange={(v) =>
              onChange({
                ...flow,
                onStepFailure: v as Flow["onStepFailure"],
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stop">Stop — skip remaining steps</SelectItem>
              <SelectItem value="continue">Continue — run all steps</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/15 p-3 space-y-2">
          <Label className="text-xs font-semibold">Flow auth</Label>
          <p className="text-[10px] text-muted-foreground">
            Steps using Flow default can authenticate with a token captured from
            a login step—no global credential required.
          </p>
          <Select
            value={flow.auth ? "login_token" : "credential"}
            onValueChange={(v) =>
              setFlowAuthMode(v as "credential" | "login_token")
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credential">
                Saved credential (navbar default)
              </SelectItem>
              <SelectItem value="login_token">Token from a step</SelectItem>
            </SelectContent>
          </Select>
          {flow.auth && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <Label className="text-[10px]">Login step</Label>
                <Select
                  value={flow.auth.loginStepId}
                  onValueChange={(id) => updateFlowAuth({ loginStepId: id })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pick step" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedSteps.map((s, i) => {
                      const ep = endpoints.find(
                        (e) => flowEndpointKey(e) === s.endpointKey
                      );
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          Step {i + 1}: {ep?.method ?? ""} {ep?.path ?? s.endpointKey}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Token variable</Label>
                <Select
                  value={flow.auth.tokenVar}
                  onValueChange={(v) => updateFlowAuth({ tokenVar: v })}
                  disabled={loginCaptureNames.length === 0}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue
                      placeholder={
                        loginCaptureNames.length === 0
                          ? "Add a capture on login step"
                          : undefined
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {loginCaptureNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Steps ({flow.steps.length})</h3>
        <div className="flex items-center gap-2">
          {flow.steps.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={toggleCollapseAll}
            >
              {allCollapsed ? (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  Expand all
                </>
              ) : (
                <>
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                  Collapse all
                </>
              )}
            </Button>
          )}
          <Popover
            open={pickerOpen}
            onOpenChange={(open) => {
              setPickerOpen(open);
              if (!open) setPickerSearch("");
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={flow.steps.length >= MAX_FLOW_STEPS}
              >
                <Plus className="h-3.5 w-3.5" />
                Add endpoint
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput
                  placeholder="Search endpoints…"
                  value={pickerSearch}
                  onValueChange={setPickerSearch}
                />
                <CommandList>
                  <CommandEmpty>No endpoint found.</CommandEmpty>
                  {controllerNames.map((controller) => {
                    const searching = pickerSearch.trim().length > 0;
                    const collapsed =
                      !searching && collapsedControllers.has(controller);
                    const items = groupedEndpoints[controller];
                    return (
                      <CommandGroup key={controller} className="p-0">
                        <button
                          type="button"
                          onClick={() => toggleController(controller)}
                          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                        >
                          {collapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            {controller}
                          </span>
                          <span className="font-normal tabular-nums text-muted-foreground/70">
                            {items.length}
                          </span>
                        </button>
                        {!collapsed &&
                          items.map((ep) => (
                            <CommandItem
                              key={flowEndpointKey(ep)}
                              value={`${ep.method} ${ep.path} ${ep.summary ?? ""}`}
                              onSelect={() => addStep(ep)}
                            >
                              <MethodBadge
                                method={ep.method}
                                className="mr-2 shrink-0"
                              />
                              <span className="font-mono text-xs truncate">
                                {ep.path}
                              </span>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={flow.steps.length >= MAX_FLOW_STEPS}
            onClick={addConditionalStep}
          >
            <Plus className="h-3.5 w-3.5" />
            Add condition
          </Button>
        </div>
      </div>

      {showValidation && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-medium">Review before running:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {validationIssues.slice(0, 5).map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
              {validationIssues.length > 5 && (
                <li>…and {validationIssues.length - 5} more</li>
              )}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] mt-1"
              onClick={() => setValidationDismissed(true)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {flow.steps.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No steps yet. Add an endpoint to start building your flow.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {orderedSteps.map((step, index) => {
          const realIndex = flow.steps.findIndex((s) => s.id === step.id);
          if (step.stepKind === "conditional") {
            const cond = step.conditional;
            return (
              <div key={step.id} className="rounded-lg border p-3 bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Conditional step
                  </p>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => removeStep(realIndex)}>
                      Remove
                    </Button>
                  </div>
                </div>
                <Input
                  value={step.name ?? ""}
                  onChange={(e) => updateStep(realIndex, { ...step, name: e.target.value })}
                  placeholder="Condition name"
                  className="h-8 text-xs"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    value={cond?.left ?? ""}
                    onChange={(e) =>
                      updateStep(realIndex, {
                        ...step,
                        conditional: {
                          left: e.target.value,
                          operator: cond?.operator ?? "equals",
                          right: cond?.right,
                        },
                      })
                    }
                    placeholder="{{vars.someValue}}"
                    className="h-8 text-xs font-mono"
                  />
                  <Select
                    value={(cond?.operator ?? "equals") as ConditionalOperator}
                    onValueChange={(v) =>
                      updateStep(realIndex, {
                        ...step,
                        conditional: {
                          left: cond?.left ?? "{{vars.value}}",
                          operator: v as ConditionalOperator,
                          right: cond?.right,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">equals</SelectItem>
                      <SelectItem value="notEquals">notEquals</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                      <SelectItem value="notContains">notContains</SelectItem>
                      <SelectItem value="gt">gt</SelectItem>
                      <SelectItem value="gte">gte</SelectItem>
                      <SelectItem value="lt">lt</SelectItem>
                      <SelectItem value="lte">lte</SelectItem>
                      <SelectItem value="isTrue">isTrue</SelectItem>
                      <SelectItem value="isFalse">isFalse</SelectItem>
                      <SelectItem value="exists">exists</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={cond?.right ?? ""}
                    onChange={(e) =>
                      updateStep(realIndex, {
                        ...step,
                        conditional: {
                          left: cond?.left ?? "{{vars.value}}",
                          operator: cond?.operator ?? "equals",
                          right: e.target.value,
                        },
                      })
                    }
                    placeholder="true / text / 200"
                    className="h-8 text-xs font-mono"
                    disabled={cond?.operator === "isTrue" || cond?.operator === "isFalse" || cond?.operator === "exists"}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Connect this step to two next steps in Diagram using true/false edges.
                </p>
              </div>
            );
          }
          return (
            <FlowStepCard
              key={step.id}
              step={step}
              index={index}
              endpoints={endpoints}
              apiData={apiData}
              baseUrl={baseUrl}
              priorSteps={orderedSteps.slice(0, index)}
              credentials={credentials}
              flowAuth={flow.auth}
              open={isStepOpen(step.id)}
              onOpenChange={(o) => setStepOpen(step.id, o)}
              selected={selectedStepId === step.id}
              canMoveUp={index > 0}
              canMoveDown={index < orderedSteps.length - 1}
              runResult={resultByStepId.get(step.id)}
              resultsByStepId={resultByStepId}
              isRunning={runningIndex === index}
              onChange={(s) => updateStep(realIndex, s)}
              onRemove={() => removeStep(realIndex)}
              onDuplicate={() => duplicateStep(realIndex)}
              onMoveUp={() => moveStep(realIndex, -1)}
              onMoveDown={() => moveStep(realIndex, 1)}
              onFocus={() => onSelectStep(step.id)}
              onSetAsLogin={() => setStepAsLogin(step.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
