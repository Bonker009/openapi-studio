import { DB_TERMS_VERSION } from "@/domain/db/config";
import type { CreateDbConnectionInput } from "@/domain/db/types";
import { encryptSecret } from "@/infrastructure/db/credential-crypto";
import {
  assertAllowedHost,
  testUserDbConnection,
  withUserDbClient,
} from "@/infrastructure/db/postgres-user-client";
import { introspectPostgresSchema } from "@/infrastructure/db/schema-introspect";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";
import { postgresDbRagRepository } from "@/infrastructure/repositories/postgres-db-rag-repository";
import { specRepository } from "@/infrastructure/repositories";

export class DbConnectionService {
  async create(input: CreateDbConnectionInput) {
    if (!input.acceptedTerms) {
      throw new Error("You must accept the database connection terms");
    }
    if (input.termsVersion !== DB_TERMS_VERSION) {
      throw new Error(`Unsupported terms version: ${input.termsVersion}`);
    }

    const exists = await specRepository.exists(input.specId);
    if (!exists) throw new Error(`Spec not found: ${input.specId}`);

    assertAllowedHost(input.host);

    const encryptedSecret = encryptSecret(input.password);
    const row = await postgresDbConnectionRepository.create({
      specId: input.specId,
      label: input.label.trim() || `${input.host}/${input.database}`,
      host: input.host.trim(),
      port: input.port,
      database: input.database.trim(),
      username: input.username.trim(),
      encryptedSecret,
      sslMode: input.sslMode?.trim() || "prefer",
      termsVersion: input.termsVersion,
      acceptedAt: new Date(),
    });

    await postgresDbConnectionRepository.recordConsent({
      connectionId: row.id,
      specId: input.specId,
      action: "accepted",
      termsVersion: input.termsVersion,
    });

    try {
      await testUserDbConnection(row);
      await postgresDbConnectionRepository.updateStatus(row.id, "active", new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection test failed";
      await postgresDbConnectionRepository.updateStatus(row.id, "error");
      throw new Error(msg);
    }

    return postgresDbConnectionRepository.findById(row.id);
  }

  async list(specId: string) {
    return postgresDbConnectionRepository.listBySpecId(specId);
  }

  async get(specId: string, connectionId: string) {
    const row = await postgresDbConnectionRepository.findForSpec(
      specId,
      connectionId
    );
    if (!row) throw new Error("Connection not found");
    return row;
  }

  async remove(specId: string, connectionId: string) {
    const row = await this.get(specId, connectionId);
    await postgresDbRagRepository.deleteChunksForConnection(connectionId);
    await postgresDbConnectionRepository.recordConsent({
      connectionId,
      specId,
      action: "revoked",
      termsVersion: row.termsVersion,
    });
    await postgresDbConnectionRepository.delete(connectionId);
  }

  async test(specId: string, connectionId: string) {
    const row = await this.get(specId, connectionId);
    await testUserDbConnection(row);
    await postgresDbConnectionRepository.updateStatus(
      connectionId,
      "active",
      new Date()
    );
    return { ok: true };
  }

  async introspect(specId: string, connectionId: string) {
    const row = await this.get(specId, connectionId);
    const snapshot = await withUserDbClient(row, async (client) =>
      introspectPostgresSchema(client)
    );
    await postgresDbConnectionRepository.saveSchemaSnapshot(
      connectionId,
      snapshot,
      snapshot.tables.length
    );
    return snapshot;
  }
}

export const dbConnectionService = new DbConnectionService();
