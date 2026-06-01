import { and, eq } from "drizzle-orm";
import { getPostgresDb, pgFlows, pgFlowSteps } from "@/infrastructure/database";
import type { Flow, FlowRunResult, StepRunResult } from "@/domain/flows/types";
import type { StepResultMetadataRecord } from "@/infrastructure/repositories/contracts";
import { postgresFlowRepository } from "@/infrastructure/repositories/postgres-flow-repository";
import { postgresFlowRunRepository } from "@/infrastructure/repositories/postgres-flow-run-repository";
import { postgresStepResultRepository } from "@/infrastructure/repositories/postgres-step-result-repository";

export const FLOW_RUN_SUMMARY_MAX = 800;
const REDACT_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "proxy-authorization",
]);

function cap(value: string, max = FLOW_RUN_SUMMARY_MAX): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function redactSummaryHeaders(
  headers: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!headers) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (REDACT_HEADERS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = typeof v === "string" ? cap(v, 120) : v;
  }
  return out;
}

function summarizeStep(step: StepRunResult) {
  return {
    stepId: step.stepId,
    stepName: step.stepName ?? null,
    status: step.status,
    outcome: step.outcome,
    latencyMs: step.latencyMs,
    error: step.error ? cap(step.error, 500) : null,
  };
}

function summarizeRequest(step: StepRunResult): Record<string, unknown> | null {
  if (!step.request) return null;
  return {
    method: step.request.method,
    url: step.request.url,
    headers: redactSummaryHeaders(
      (step.request.headers as Record<string, unknown> | undefined) ?? undefined
    ),
  };
}

function summarizeResponse(step: StepRunResult): Record<string, unknown> | null {
  if (!step.response) return null;
  return {
    status: step.response.status ?? step.status,
    statusText: step.response.statusText ?? step.statusText ?? null,
    headers: redactSummaryHeaders(
      (step.response.headers as Record<string, unknown> | undefined) ?? undefined
    ),
  };
}

export async function listPersistedFlows(specId: string): Promise<Flow[]> {
  return postgresFlowRepository.findBySpecId({ specId });
}

export async function savePersistedFlow(flow: Flow): Promise<Flow> {
  return postgresFlowRepository.save({ flow });
}

export async function deletePersistedFlow(
  specId: string,
  flowId: string
): Promise<boolean> {
  return postgresFlowRepository.delete(specId, flowId);
}

export async function loadFlowForExecution(
  specId: string,
  flowId: string
): Promise<Flow | null> {
  return postgresFlowRepository.findById(specId, flowId);
}

export async function persistFlowRunMetadata(params: {
  flow: Flow;
  run: FlowRunResult;
}): Promise<void> {
  const flowRow = await getPostgresDb().query.pgFlows.findFirst({
    where: and(
      eq(pgFlows.specId, params.flow.specId),
      eq(pgFlows.flowKey, params.flow.id)
    ),
  });
  if (!flowRow) return;

  const status =
    params.run.outcome === "pass"
      ? "success"
      : params.run.outcome === "skipped"
        ? "success"
        : "failed";

  const runRecord = await postgresFlowRunRepository.createRun({
    flowId: flowRow.id,
    status,
    startedAt: new Date(params.run.startedAt).toISOString(),
    finishedAt: params.run.finishedAt
      ? new Date(params.run.finishedAt).toISOString()
      : null,
    durationMs:
      params.run.finishedAt && params.run.startedAt
        ? params.run.finishedAt - params.run.startedAt
        : null,
    summary: {
      outcome: params.run.outcome,
      totalSteps: params.run.steps.length,
      failedSteps: params.run.steps.filter(
        (s) => s.outcome === "fail" || s.outcome === "error"
      ).length,
      steps: params.run.steps.map(summarizeStep),
    },
  });

  const stepRows = await getPostgresDb().query.pgFlowSteps.findMany({
    where: eq(pgFlowSteps.flowId, flowRow.id),
  });
  const stepIdByKey = new Map(stepRows.map((row) => [row.stepKey, row.id]));

  const stepRecords: StepResultMetadataRecord[] = [];
  for (const step of params.run.steps) {
    const dbStepId = stepIdByKey.get(step.stepId);
    if (!dbStepId) continue;
    const assertionResult: Record<string, unknown> | null =
      step.assertions?.length != null
        ? {
            total: step.assertions.length,
            failed: step.assertions.filter((a) => !a.passed).length,
          }
        : null;
    stepRecords.push({
      runId: runRecord.id,
      stepId: dbStepId,
      status: step.outcome,
      durationMs: step.latencyMs,
      assertionResult,
      extractedValues: (step.capturedVars ?? null) as Record<
        string,
        unknown
      > | null,
      requestSummary: summarizeRequest(step),
      responseSummary: summarizeResponse(step),
      errorMessage: step.error ? cap(step.error, 500) : null,
    });
  }

  await postgresStepResultRepository.insertMany(stepRecords);
}
