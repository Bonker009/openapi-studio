import { and, desc, eq } from "drizzle-orm";
import { getPostgresDb, pgEndpointNotes } from "@/infrastructure/database";
import type { EndpointNoteRow } from "./domain-types";

export class PostgresEndpointNotesRepository {
  async list(
    specId: string,
    path: string,
    method: string
  ): Promise<EndpointNoteRow[]> {
    const methodLower = method.toLowerCase();
    const rows = await getPostgresDb()
      .select()
      .from(pgEndpointNotes)
      .where(
        and(
          eq(pgEndpointNotes.specId, specId),
          eq(pgEndpointNotes.path, path),
          eq(pgEndpointNotes.method, methodLower)
        )
      )
      .orderBy(desc(pgEndpointNotes.ts));
    return rows.map((r) => ({
      id: r.id,
      specId: r.specId,
      path: r.path,
      method: r.method,
      ts: r.ts,
      kind: r.kind,
      body: r.body,
    }));
  }

  async append(
    specId: string,
    path: string,
    method: string,
    input: { body: string; kind?: string }
  ): Promise<EndpointNoteRow> {
    const ts = Date.now();
    const methodLower = method.toLowerCase();
    const [row] = await getPostgresDb()
      .insert(pgEndpointNotes)
      .values({
        specId,
        path,
        method: methodLower,
        ts,
        kind: input.kind?.trim() || "note",
        body: input.body.trim(),
      })
      .returning();
    return {
      id: row.id,
      specId: row.specId,
      path: row.path,
      method: row.method,
      ts: row.ts,
      kind: row.kind,
      body: row.body,
    };
  }

  async delete(specId: string, noteId: number): Promise<boolean> {
    const existing = await getPostgresDb().query.pgEndpointNotes.findFirst({
      where: and(
        eq(pgEndpointNotes.specId, specId),
        eq(pgEndpointNotes.id, noteId)
      ),
      columns: { id: true },
    });
    if (!existing) return false;
    await getPostgresDb()
      .delete(pgEndpointNotes)
      .where(
        and(eq(pgEndpointNotes.specId, specId), eq(pgEndpointNotes.id, noteId))
      );
    return true;
  }
}

export const postgresEndpointNotesRepository =
  new PostgresEndpointNotesRepository();
