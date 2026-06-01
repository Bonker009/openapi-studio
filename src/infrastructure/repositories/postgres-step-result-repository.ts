import { randomUUID } from "node:crypto";
import { getPostgresDb, pgStepResults } from "@/infrastructure/database";
import type {
  StepResultMetadataRecord,
  StepResultRepository,
} from "./contracts";

export class PostgresStepResultRepository implements StepResultRepository {
  async insertMany(records: StepResultMetadataRecord[]): Promise<void> {
    if (records.length === 0) return;
    await getPostgresDb().insert(pgStepResults).values(
      records.map((record) => ({
        id: randomUUID(),
        runId: record.runId,
        stepId: record.stepId,
        status: record.status,
        durationMs: record.durationMs,
        assertionResult: record.assertionResult,
        extractedValues: record.extractedValues,
        requestSummary: record.requestSummary,
        responseSummary: record.responseSummary,
        errorMessage: record.errorMessage,
      }))
    );
  }
}

export const postgresStepResultRepository = new PostgresStepResultRepository();
