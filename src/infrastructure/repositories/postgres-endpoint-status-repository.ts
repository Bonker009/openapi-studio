import { eq } from "drizzle-orm";
import { getPostgresDb, pgEndpointStatuses } from "@/infrastructure/database";
import type { EndpointStatusRow } from "./domain-types";
import type { EndpointStatusRepository } from "./contracts";

export class PostgresEndpointStatusRepository implements EndpointStatusRepository {
  async findBySpecId(specId: string): Promise<EndpointStatusRow[] | null> {
    const rows = await getPostgresDb()
      .select()
      .from(pgEndpointStatuses)
      .where(eq(pgEndpointStatuses.specId, specId));
    if (rows.length === 0) return null;
    return rows.map((r) => ({
      path: r.path,
      method: r.method,
      working: r.working,
      notes: r.notes,
    }));
  }

  async save(specId: string, data: EndpointStatusRow[]): Promise<void> {
    const db = getPostgresDb();
    await db
      .delete(pgEndpointStatuses)
      .where(eq(pgEndpointStatuses.specId, specId));
    if (data.length === 0) return;
    await db.insert(pgEndpointStatuses).values(
      data.map((row) => ({
        specId,
        path: row.path,
        method: row.method,
        working: row.working,
        notes: row.notes ?? "",
      }))
    );
  }

  async delete(specId: string): Promise<void> {
    await getPostgresDb()
      .delete(pgEndpointStatuses)
      .where(eq(pgEndpointStatuses.specId, specId));
  }
}

export const postgresEndpointStatusRepository =
  new PostgresEndpointStatusRepository();
