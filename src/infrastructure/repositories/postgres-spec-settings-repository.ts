import { eq } from "drizzle-orm";
import { getPostgresDb, pgSpecSettings } from "@/infrastructure/database";
import type { SpecSettingsData } from "./domain-types";
import type { SpecSettingsRepository } from "./contracts";

export class PostgresSpecSettingsRepository implements SpecSettingsRepository {
  async findBySpecId(specId: string): Promise<SpecSettingsData | null> {
    const row = await getPostgresDb().query.pgSpecSettings.findFirst({
      where: eq(pgSpecSettings.specId, specId),
    });
    if (!row) return null;
    const parsed = row.expandedControllersJson as {
      expandedControllers?: Record<string, boolean>;
    };
    return {
      expandedControllers: parsed.expandedControllers ?? {},
    };
  }

  async save(specId: string, data: SpecSettingsData): Promise<void> {
    await getPostgresDb()
      .insert(pgSpecSettings)
      .values({
        specId,
        expandedControllersJson: data,
      })
      .onConflictDoUpdate({
        target: pgSpecSettings.specId,
        set: { expandedControllersJson: data },
      });
  }

  async delete(specId: string): Promise<void> {
    await getPostgresDb()
      .delete(pgSpecSettings)
      .where(eq(pgSpecSettings.specId, specId));
  }
}

export const postgresSpecSettingsRepository =
  new PostgresSpecSettingsRepository();
