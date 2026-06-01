import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getPostgresDb,
  pgEnvironments,
  pgFlows,
  pgFlowSteps,
} from "@/infrastructure/database";
import type {
  FlowListQuery,
  FlowRepository,
  PersistedFlowStep,
  SaveFlowInput,
  StepRepository,
} from "./contracts";
import type { Flow, FlowStep } from "@/domain/flows/types";
import type { FlowEnvironment } from "@/domain/flows/types/schema";

type FlowRow = typeof pgFlows.$inferSelect;
type StepRow = typeof pgFlowSteps.$inferSelect;
type EnvironmentRow = typeof pgEnvironments.$inferSelect;

function parseBodyToJson(body?: string): unknown {
  if (!body?.trim()) return null;
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

function stringifyBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") {
    return body;
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

function methodAndPathFromStep(step: FlowStep): { method: string; url: string } {
  const [method = "GET", ...path] = step.endpointKey.split(":");
  return { method, url: path.join(":") };
}

function mapStepToInsert(flowDbId: string, step: FlowStep, orderIndex: number) {
  const { method, url } = methodAndPathFromStep(step);
  return {
    id: randomUUID(),
    flowId: flowDbId,
    stepKey: step.id,
    name: step.name?.trim() || `${method} ${url}`,
    method,
    url,
    headers: step.headerValues ?? {},
    body: parseBodyToJson(step.body),
    auth: {
      credentialName: step.credentialName ?? null,
    },
    stepConfig: {
      endpointKey: step.endpointKey,
      paramValues: step.paramValues ?? {},
      headerValues: step.headerValues ?? {},
      extractions: step.extractions ?? [],
      expectedStatus: step.expectedStatus ?? null,
      pauseAfter: step.pauseAfter ?? false,
      delayMs: step.delayMs ?? null,
      retry: step.retry ?? null,
      ui: step.ui ?? null,
      condition: step.condition ?? null,
    },
    orderIndex,
  };
}

function mapEnvironmentToDomain(
  row: EnvironmentRow,
  baseUrl: string | null
): FlowEnvironment {
  return {
    id: row.id,
    name: row.name,
    baseUrl: baseUrl ?? "",
    variables: (row.variables ?? {}) as Record<string, string>,
  };
}

function mapStepRowToDomain(step: StepRow): FlowStep {
  const cfg = (step.stepConfig ?? {}) as Record<string, unknown>;
  return {
    id: step.stepKey,
    name: step.name,
    endpointKey:
      typeof cfg.endpointKey === "string"
        ? cfg.endpointKey
        : `${step.method}:${step.url}`,
    paramValues: (cfg.paramValues as Record<string, string>) ?? {},
    headerValues: (cfg.headerValues as Record<string, string>) ?? {},
    body: stringifyBody(step.body),
    extractions: (cfg.extractions as FlowStep["extractions"]) ?? [],
    expectedStatus:
      typeof cfg.expectedStatus === "number" ? cfg.expectedStatus : undefined,
    credentialName:
      typeof (step.auth as { credentialName?: unknown } | null)?.credentialName ===
      "string"
        ? (step.auth as { credentialName: string }).credentialName
        : undefined,
    pauseAfter: Boolean(cfg.pauseAfter),
    delayMs: typeof cfg.delayMs === "number" ? cfg.delayMs : undefined,
    retry:
      cfg.retry &&
      typeof cfg.retry === "object" &&
      typeof (cfg.retry as { count?: unknown }).count === "number" &&
      typeof (cfg.retry as { delayMs?: unknown }).delayMs === "number"
        ? (cfg.retry as { count: number; delayMs: number })
        : undefined,
    ui:
      cfg.ui && typeof cfg.ui === "object"
        ? (cfg.ui as NonNullable<FlowStep["ui"]>)
        : undefined,
    condition: typeof cfg.condition === "string" ? cfg.condition : undefined,
  };
}

function mapFlowRowsToDomain(
  flow: FlowRow,
  steps: StepRow[],
  env?: EnvironmentRow | null
): Flow {
  const config = (flow.config ?? {}) as Record<string, unknown>;
  return {
    id: flow.flowKey,
    specId: flow.specId,
    name: flow.name,
    description: flow.description ?? "",
    baseUrl: flow.baseUrl ?? undefined,
    variables: (config.variables as Record<string, string>) ?? undefined,
    environment: env
      ? mapEnvironmentToDomain(env, flow.baseUrl)
      : (config.environment as Flow["environment"]) ?? undefined,
    executionMode: config.executionMode as Flow["executionMode"],
    steps: steps.sort((a, b) => a.orderIndex - b.orderIndex).map(mapStepRowToDomain),
    auth: (config.auth as Flow["auth"]) ?? undefined,
    onStepFailure:
      config.onStepFailure === "continue" ? "continue" : "stop",
    connections: (config.connections as Flow["connections"]) ?? undefined,
    diagramPositions:
      (config.diagramPositions as Flow["diagramPositions"]) ?? undefined,
    createdAt: flow.createdAt.getTime(),
    updatedAt: flow.updatedAt.getTime(),
  };
}

export class PostgresStepRepository implements StepRepository {
  async findByFlowDbId(flowDbId: string): Promise<PersistedFlowStep[]> {
    const rows = await getPostgresDb().query.pgFlowSteps.findMany({
      where: eq(pgFlowSteps.flowId, flowDbId),
      orderBy: [pgFlowSteps.orderIndex],
    });
    return rows.map((row) => ({
      ...mapStepRowToDomain(row),
      dbId: row.id,
      flowDbId: row.flowId,
      stepKey: row.stepKey,
      orderIndex: row.orderIndex,
    }));
  }
}

export class PostgresFlowRepository implements FlowRepository {
  constructor(private readonly stepRepo: StepRepository = new PostgresStepRepository()) {}

  async findBySpecId(query: FlowListQuery): Promise<Flow[]> {
    const flowRows = await getPostgresDb().query.pgFlows.findMany({
      where: eq(pgFlows.specId, query.specId),
      orderBy: [desc(pgFlows.updatedAt)],
    });
    if (flowRows.length === 0) return [];
    const flowIds = flowRows.map((f) => f.id);
    const stepRows = await getPostgresDb().query.pgFlowSteps.findMany({
      where: inArray(pgFlowSteps.flowId, flowIds),
      orderBy: [pgFlowSteps.orderIndex],
    });
    const envIds = flowRows.map((f) => f.environmentId).filter(Boolean) as string[];
    const envRows =
      envIds.length > 0
        ? await getPostgresDb().query.pgEnvironments.findMany({
            where: inArray(pgEnvironments.id, envIds),
          })
        : [];
    const envMap = new Map(envRows.map((e) => [e.id, e]));
    const stepsByFlow = new Map<string, StepRow[]>();
    for (const step of stepRows) {
      const bucket = stepsByFlow.get(step.flowId) ?? [];
      bucket.push(step);
      stepsByFlow.set(step.flowId, bucket);
    }
    return flowRows.map((f) =>
      mapFlowRowsToDomain(
        f,
        stepsByFlow.get(f.id) ?? [],
        f.environmentId ? envMap.get(f.environmentId) ?? null : null
      )
    );
  }

  async findById(specId: string, flowId: string): Promise<Flow | null> {
    const row = await getPostgresDb().query.pgFlows.findFirst({
      where: and(eq(pgFlows.specId, specId), eq(pgFlows.flowKey, flowId)),
    });
    if (!row) return null;
    const steps = await getPostgresDb().query.pgFlowSteps.findMany({
      where: eq(pgFlowSteps.flowId, row.id),
      orderBy: [pgFlowSteps.orderIndex],
    });
    const env = row.environmentId
      ? await getPostgresDb().query.pgEnvironments.findFirst({
          where: eq(pgEnvironments.id, row.environmentId),
        })
      : null;
    return mapFlowRowsToDomain(row, steps, env);
  }

  async save(input: SaveFlowInput): Promise<Flow> {
    const flow = input.flow;
    const now = new Date();
    const normalized: Flow = {
      ...flow,
      createdAt: flow.createdAt || Date.now(),
      updatedAt: Date.now(),
      onStepFailure: flow.onStepFailure ?? "stop",
      steps: flow.steps ?? [],
    };

    const envRecord =
      normalized.environment &&
      typeof normalized.environment === "object" &&
      "name" in normalized.environment &&
      "variables" in normalized.environment
        ? (normalized.environment as { id?: string; name: string; variables: Record<string, string> })
        : null;

    const savedFlow = await getPostgresDb().transaction(async (tx) => {
      let environmentId: string | null = null;
      if (envRecord?.name?.trim()) {
        if (envRecord.id) {
          await tx
            .insert(pgEnvironments)
            .values({
              id: envRecord.id,
              name: envRecord.name.trim(),
              variables: envRecord.variables ?? {},
            })
            .onConflictDoUpdate({
              target: pgEnvironments.id,
              set: {
                name: envRecord.name.trim(),
                variables: envRecord.variables ?? {},
              },
            });
          environmentId = envRecord.id;
        } else {
          const [insertedEnv] = await tx
            .insert(pgEnvironments)
            .values({
              id: randomUUID(),
              name: envRecord.name.trim(),
              variables: envRecord.variables ?? {},
            })
            .returning({ id: pgEnvironments.id });
          environmentId = insertedEnv.id;
        }
      }

      const [flowRow] = await tx
        .insert(pgFlows)
        .values({
          id: randomUUID(),
          specId: normalized.specId,
          flowKey: normalized.id,
          name: normalized.name.trim() || "Untitled flow",
          description: normalized.description ?? "",
          baseUrl: normalized.baseUrl ?? null,
          config: {
            variables: normalized.variables ?? null,
            executionMode: normalized.executionMode ?? "sequential",
            auth: normalized.auth ?? null,
            onStepFailure: normalized.onStepFailure,
            connections: normalized.connections ?? null,
            diagramPositions: normalized.diagramPositions ?? null,
          },
          environmentId,
          createdAt: new Date(normalized.createdAt),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [pgFlows.specId, pgFlows.flowKey],
          set: {
            name: normalized.name.trim() || "Untitled flow",
            description: normalized.description ?? "",
            baseUrl: normalized.baseUrl ?? null,
            config: {
              variables: normalized.variables ?? null,
              executionMode: normalized.executionMode ?? "sequential",
              auth: normalized.auth ?? null,
              onStepFailure: normalized.onStepFailure,
              connections: normalized.connections ?? null,
              diagramPositions: normalized.diagramPositions ?? null,
            },
            environmentId,
            updatedAt: now,
          },
        })
        .returning({
          id: pgFlows.id,
          specId: pgFlows.specId,
          flowKey: pgFlows.flowKey,
        });

      await tx.delete(pgFlowSteps).where(eq(pgFlowSteps.flowId, flowRow.id));
      if (normalized.steps.length > 0) {
        await tx.insert(pgFlowSteps).values(
          normalized.steps.map((step, i) => mapStepToInsert(flowRow.id, step, i))
        );
      }
      return flowRow;
    });

    const persisted = await this.findById(savedFlow.specId, savedFlow.flowKey);
    if (!persisted) {
      throw new Error("Failed to reload saved flow");
    }
    return persisted;
  }

  async delete(specId: string, flowId: string): Promise<boolean> {
    const deleted = await getPostgresDb()
      .delete(pgFlows)
      .where(and(eq(pgFlows.specId, specId), eq(pgFlows.flowKey, flowId)))
      .returning({ id: pgFlows.id });
    return deleted.length > 0;
  }
}

export const postgresStepRepository = new PostgresStepRepository();
export const postgresFlowRepository = new PostgresFlowRepository(
  postgresStepRepository
);
