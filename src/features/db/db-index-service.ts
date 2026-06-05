import { withUserDbClient } from "@/infrastructure/db/postgres-user-client";
import { introspectPostgresSchema } from "@/infrastructure/db/schema-introspect";
import {
  buildTableChunkText,
  fetchMicroSample,
} from "@/infrastructure/db/db-chunk-builder";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";
import { postgresDbRagRepository } from "@/infrastructure/repositories/postgres-db-rag-repository";
import { dbConnectionService } from "@/features/db/db-connection-service";

export class DbIndexService {
  async indexConnection(specId: string, connectionId: string) {
    const row = await dbConnectionService.get(specId, connectionId);
    const snapshot = await withUserDbClient(row, async (client) => {
      const schema = await introspectPostgresSchema(client);
      await postgresDbConnectionRepository.saveSchemaSnapshot(
        connectionId,
        schema,
        schema.tables.length
      );

      await postgresDbRagRepository.deleteChunksForConnection(connectionId);

      for (const table of schema.tables) {
        const sample = await fetchMicroSample(client, table);
        const content = buildTableChunkText(table, sample);
        await postgresDbRagRepository.upsertChunk({
          connectionId,
          chunkKey: `${table.schema}.${table.name}`,
          tableName: table.name,
          title: `Table ${table.name}`,
          content,
          metadata: { schema: table.schema, columnCount: table.columns.length },
        });
      }

      return schema;
    });

    return {
      connectionId,
      tableCount: snapshot.tables.length,
      chunkCount: snapshot.tables.length,
      indexedAt: Date.now(),
    };
  }
}

export const dbIndexService = new DbIndexService();
