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
