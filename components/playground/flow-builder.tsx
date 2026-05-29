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
  flowEndpointKey,
  MAX_FLOW_STEPS,
  newStepId,
  type Flow,
  type FlowStep,
  type StepRunResult,
} from "@/lib/flows/types";
import { MethodBadge } from "@/components/method-badge";
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
    () => validateFlowSteps(flow.steps, endpoints),
    [flow.steps, endpoints]
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

  const resultByStepId = useMemo(() => {
    const m = new Map<string, StepRunResult>();
    for (const r of runResults) m.set(r.stepId, r);
    return m;
  }, [runResults]);

  // Display in execution order so the builder matches the wired run order.
  const orderedSteps = useMemo(() => orderSteps(flow), [flow]);

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
            />
          );
        })}
      </div>
    </div>
  );
}
