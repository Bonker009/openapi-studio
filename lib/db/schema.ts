import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  primaryKey,
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
