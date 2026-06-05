export type DbConnectionStatus = "pending" | "active" | "error" | "revoked";

export type DbColumnMeta = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
};

export type DbForeignKeyMeta = {
  column: string;
  referencedTable: string;
  referencedColumn: string;
};

export type DbTableSchema = {
  name: string;
  schema: string;
  columns: DbColumnMeta[];
  foreignKeys: DbForeignKeyMeta[];
  approximateRowCount?: number;
};

export type DbSchemaSnapshot = {
  tables: DbTableSchema[];
  introspectedAt: string;
};

export type DbConnectionPublic = {
  id: string;
  specId: string;
  label: string;
  host: string;
  port: number;
  database: string;
  username: string;
  sslMode: string;
  readOnly: boolean;
  termsVersion: string;
  acceptedAt: string;
  status: DbConnectionStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  indexedChunkCount?: number;
  tableCount?: number;
};

export type CreateDbConnectionInput = {
  specId: string;
  label: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode?: string;
  termsVersion: string;
  acceptedTerms: boolean;
};

export type DbAgentInput = {
  specId: string;
  connectionId: string;
  question: string;
  conversationId?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  chatProvider?: "openai" | "groq";
  chatModel?: string;
};

export type DbSuggestPayloadInput = {
  specId: string;
  connectionId: string;
  endpointKey: string;
  paramNames: string[];
  method?: string;
  path?: string;
};

export type DbSuggestPayloadOutput = {
  suggestions: Record<string, string>;
  sources: Record<string, { table: string; confidence: number }>;
};
