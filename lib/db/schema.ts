import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";

export const specs = sqliteTable("specs", {
  id: text("id").primaryKey(),
  openapiJson: text("openapi_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const specVersions = sqliteTable(
  "spec_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    specId: text("spec_id")
      .notNull()
      .references(() => specs.id, { onDelete: "cascade" }),
    ts: integer("ts").notNull(),
    version: text("version").notNull(),
    note: text("note"),
    summaryJson: text("summary_json"),
    isRestore: integer("is_restore", { mode: "boolean" }).default(false),
    snapshotJson: text("snapshot_json").notNull(),
  },
  (table) => [
    uniqueIndex("spec_versions_spec_id_ts").on(table.specId, table.ts),
  ]
);

export const endpointStatuses = sqliteTable(
  "endpoint_statuses",
  {
    specId: text("spec_id")
      .notNull()
      .references(() => specs.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    method: text("method").notNull(),
    working: integer("working", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    primaryKey({ columns: [table.specId, table.path, table.method] }),
  ]
);

export const specSettings = sqliteTable("spec_settings", {
  specId: text("spec_id")
    .primaryKey()
    .references(() => specs.id, { onDelete: "cascade" }),
  expandedControllersJson: text("expanded_controllers_json")
    .notNull()
    .default("{}"),
});

export const endpointNotes = sqliteTable(
  "endpoint_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    specId: text("spec_id")
      .notNull()
      .references(() => specs.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    method: text("method").notNull(),
    ts: integer("ts").notNull(),
    kind: text("kind").notNull().default("note"),
    body: text("body").notNull(),
  },
  (table) => [
    index("endpoint_notes_lookup").on(
      table.specId,
      table.path,
      table.method,
      table.ts
    ),
  ]
);

export const flows = sqliteTable(
  "flows",
  {
    id: text("id").primaryKey(),
    specId: text("spec_id")
      .notNull()
      .references(() => specs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    flowJson: text("flow_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("flows_spec_id").on(table.specId)]
);
