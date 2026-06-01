import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getPostgresDb, pgEnvironments } from "@/src/infrastructure/database";
import type {
  EnvironmentRepository,
  FlowEnvironmentRecord,
} from "./contracts";

function mapEnvironment(
  row: typeof pgEnvironments.$inferSelect
): FlowEnvironmentRecord {
  return {
    id: row.id,
    name: row.name,
    variables: (row.variables ?? {}) as Record<string, string>,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PostgresEnvironmentRepository implements EnvironmentRepository {
  async findById(id: string): Promise<FlowEnvironmentRecord | null> {
    const row = await getPostgresDb().query.pgEnvironments.findFirst({
      where: eq(pgEnvironments.id, id),
    });
    return row ? mapEnvironment(row) : null;
  }

  async findByName(name: string): Promise<FlowEnvironmentRecord | null> {
    const row = await getPostgresDb().query.pgEnvironments.findFirst({
      where: eq(pgEnvironments.name, name),
      orderBy: [desc(pgEnvironments.createdAt)],
    });
    return row ? mapEnvironment(row) : null;
  }

  async upsert(
    name: string,
    variables: Record<string, string>
  ): Promise<FlowEnvironmentRecord> {
    const existing = await this.findByName(name);
    if (existing) {
      const [updated] = await getPostgresDb()
        .update(pgEnvironments)
        .set({
          variables,
        })
        .where(eq(pgEnvironments.id, existing.id))
        .returning();
      return mapEnvironment(updated);
    }

    const [inserted] = await getPostgresDb()
      .insert(pgEnvironments)
      .values({
        id: randomUUID(),
        name,
        variables,
      })
      .returning();
    return mapEnvironment(inserted);
  }
}

export const postgresEnvironmentRepository =
  new PostgresEnvironmentRepository();
