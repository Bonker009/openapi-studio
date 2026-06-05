import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const pgSpecs = pgTable("specs", {
  id: text("id").primaryKey(),
  openapiJson: jsonb("openapi_json").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const pgSpecVersions = pgTable(
  "spec_versions",
  {
    id: serial("id").primaryKey(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    ts: bigint("ts", { mode: "number" }).notNull(),
    version: text("version").notNull(),
    note: text("note"),
    summaryJson: jsonb("summary_json"),
    isRestore: boolean("is_restore").notNull().default(false),
    snapshotJson: jsonb("snapshot_json").notNull(),
  },
  (table) => [uniqueIndex("spec_versions_spec_id_ts_uq").on(table.specId, table.ts)]
);

export const pgEndpointStatuses = pgTable(
  "endpoint_statuses",
  {
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    method: text("method").notNull(),
    working: boolean("working").notNull().default(false),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    primaryKey({ columns: [table.specId, table.path, table.method] }),
  ]
);

export const pgSpecSettings = pgTable("spec_settings", {
  specId: text("spec_id")
    .primaryKey()
    .references(() => pgSpecs.id, { onDelete: "cascade" }),
  expandedControllersJson: jsonb("expanded_controllers_json")
    .notNull()
    .default({}),
});

export const pgEndpointNotes = pgTable(
  "endpoint_notes",
  {
    id: serial("id").primaryKey(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    method: text("method").notNull(),
    ts: bigint("ts", { mode: "number" }).notNull(),
    kind: text("kind").notNull().default("note"),
    body: text("body").notNull(),
  },
  (table) => [
    index("endpoint_notes_lookup_idx").on(
      table.specId,
      table.path,
      table.method,
      table.ts
    ),
  ]
);

export const pgEnvironments = pgTable("environments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  variables: jsonb("variables").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pgFlows = pgTable(
  "flows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    flowKey: text("flow_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    baseUrl: text("base_url"),
    config: jsonb("config").notNull().default({}),
    environmentId: uuid("environment_id").references(() => pgEnvironments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("flows_spec_id_idx").on(table.specId),
    uniqueIndex("flows_spec_flow_key_uq").on(table.specId, table.flowKey),
    index("flows_env_id_idx").on(table.environmentId),
  ]
);

export const pgFlowSteps = pgTable(
  "flow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => pgFlows.id, { onDelete: "cascade" }),
    /**
     * Stable step identifier from legacy FlowStep.id (non-uuid ids supported).
     */
    stepKey: text("step_key").notNull(),
    name: text("name").notNull(),
    method: text("method").notNull(),
    url: text("url").notNull(),
    headers: jsonb("headers").notNull().default({}),
    body: jsonb("body"),
    auth: jsonb("auth"),
    stepConfig: jsonb("step_config").notNull().default({}),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("flow_steps_flow_order_idx").on(table.flowId, table.orderIndex),
    uniqueIndex("flow_steps_flow_step_key_uq").on(table.flowId, table.stepKey),
  ]
);

export const pgFlowCollections = pgTable("flow_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  specId: text("spec_id")
    .notNull()
    .references(() => pgSpecs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pgFlowCollectionItems = pgTable(
  "flow_collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => pgFlowCollections.id, { onDelete: "cascade" }),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => pgFlows.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.flowId] }),
    index("flow_collection_items_order_idx").on(table.collectionId, table.orderIndex),
  ]
);

export const pgFlowVersions = pgTable(
  "flow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => pgFlows.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    note: text("note"),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("flow_versions_flow_created_idx").on(table.flowId, table.createdAt)]
);

export const pgFlowRuns = pgTable(
  "flow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => pgFlows.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    summary: jsonb("summary").notNull().default({}),
  },
  (table) => [index("flow_runs_flow_started_idx").on(table.flowId, table.startedAt)]
);

export const pgStepResults = pgTable(
  "step_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => pgFlowRuns.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => pgFlowSteps.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    durationMs: integer("duration_ms"),
    assertionResult: jsonb("assertion_result"),
    extractedValues: jsonb("extracted_values"),
    requestSummary: jsonb("request_summary"),
    responseSummary: jsonb("response_summary"),
    errorMessage: text("error_message"),
  },
  (table) => [index("step_results_run_step_idx").on(table.runId, table.stepId)]
);

export type PgFlow = typeof pgFlows.$inferSelect;
export type PgFlowStep = typeof pgFlowSteps.$inferSelect;
export type PgEnvironment = typeof pgEnvironments.$inferSelect;
export type PgFlowRun = typeof pgFlowRuns.$inferSelect;
export type PgStepResult = typeof pgStepResults.$inferSelect;

export const pgAiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ai_conversations_spec_idx").on(table.specId)]
);

export const pgAiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => pgAiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ai_messages_conversation_idx").on(table.conversationId)]
);

export const pgAiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => pgAiConversations.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(),
    inputJson: jsonb("input_json").notNull().default({}),
    outputJson: jsonb("output_json").notNull().default({}),
    validationJson: jsonb("validation_json").notNull().default({}),
    attempt: integer("attempt").notNull().default(1),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_generations_spec_created_idx").on(table.specId, table.createdAt),
  ]
);

export const pgEndpointIndex = pgTable(
  "endpoint_index",
  {
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    endpointKey: text("endpoint_key").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    requiresAuth: boolean("requires_auth").notNull().default(false),
    summary: text("summary"),
    searchText: text("search_text").notNull().default(""),
    metadata: jsonb("metadata").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.specId, table.endpointKey] }),
    index("endpoint_index_spec_method_idx").on(table.specId, table.method),
  ]
);

export const pgOpenapiChunks = pgTable(
  "openapi_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    chunkKey: text("chunk_key").notNull(),
    chunkType: text("chunk_type").notNull(),
    endpointKey: text("endpoint_key"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    embeddingJson: jsonb("embedding_json"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("openapi_chunks_spec_chunk_key_uq").on(table.specId, table.chunkKey),
    index("openapi_chunks_spec_type_idx").on(table.specId, table.chunkType),
  ]
);

export const pgDbConnections = pgTable(
  "db_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    host: text("host").notNull(),
    port: integer("port").notNull().default(5432),
    database: text("database").notNull(),
    username: text("username").notNull(),
    sslMode: text("ssl_mode").notNull().default("prefer"),
    encryptedSecret: text("encrypted_secret").notNull(),
    readOnly: boolean("read_only").notNull().default(true),
    termsVersion: text("terms_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("db_connections_spec_idx").on(table.specId)]
);

export const pgDbSchemaSnapshots = pgTable(
  "db_schema_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => pgDbConnections.id, { onDelete: "cascade" }),
    schemaJson: jsonb("schema_json").notNull().default({}),
    tableCount: integer("table_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("db_schema_snapshots_connection_idx").on(table.connectionId),
  ]
);

export const pgDbRagChunks = pgTable(
  "db_rag_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => pgDbConnections.id, { onDelete: "cascade" }),
    chunkKey: text("chunk_key").notNull(),
    tableName: text("table_name").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    embeddingJson: jsonb("embedding_json"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("db_rag_chunks_connection_chunk_key_uq").on(
      table.connectionId,
      table.chunkKey
    ),
    index("db_rag_chunks_connection_idx").on(table.connectionId),
  ]
);

export const pgDbQueryAudit = pgTable(
  "db_query_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => pgDbConnections.id, { onDelete: "cascade" }),
    sqlHash: text("sql_hash").notNull(),
    sqlPreview: text("sql_preview").notNull(),
    rowCount: integer("row_count"),
    durationMs: integer("duration_ms"),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    source: text("source").notNull().default("agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("db_query_audit_connection_created_idx").on(
      table.connectionId,
      table.createdAt
    ),
  ]
);

export const pgDbConsentEvents = pgTable(
  "db_consent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id").references(() => pgDbConnections.id, {
      onDelete: "set null",
    }),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    termsVersion: text("terms_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("db_consent_events_spec_idx").on(table.specId)]
);

export const pgFlowAiCache = pgTable(
  "flow_ai_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specId: text("spec_id")
      .notNull()
      .references(() => pgSpecs.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key").notNull(),
    flowSchemaJson: jsonb("flow_schema_json").notNull(),
    internalFlowJson: jsonb("internal_flow_json").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("flow_ai_cache_spec_key_uq").on(table.specId, table.cacheKey),
  ]
);
