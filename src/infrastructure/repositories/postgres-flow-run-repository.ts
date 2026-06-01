import { randomUUID } from "node:crypto";
import { getPostgresDb, pgFlowRuns } from "@/infrastructure/database";
import type { FlowRunRecord, FlowRunRepository } from "./contracts";

function mapRun(row: typeof pgFlowRuns.$inferSelect): FlowRunRecord {
  return {
    id: row.id,
    flowId: row.flowId,
    status: row.status as FlowRunRecord["status"],
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    durationMs: row.durationMs,
    summary: (row.summary ?? {}) as Record<string, unknown>,
  };
}

export class PostgresFlowRunRepository implements FlowRunRepository {
  async createRun(record: Omit<FlowRunRecord, "id">): Promise<FlowRunRecord> {
    const [inserted] = await getPostgresDb()
      .insert(pgFlowRuns)
      .values({
        id: randomUUID(),
        flowId: record.flowId,
        status: record.status,
        startedAt: new Date(record.startedAt),
        finishedAt: record.finishedAt ? new Date(record.finishedAt) : null,
        durationMs: record.durationMs ?? null,
        summary: record.summary ?? {},
      })
      .returning();
    return mapRun(inserted);
  }
}

export const postgresFlowRunRepository = new PostgresFlowRunRepository();
