import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getPostgresDb } from "./postgres-client";

let migrated = false;

/** Resolved from project root so migrations work regardless of process cwd. */
export function getPostgresMigrationsFolder(): string {
  return path.join(process.cwd(), "drizzle", "pg");
}

export async function runPostgresMigrations() {
  if (migrated) return;
  await migrate(getPostgresDb(), {
    migrationsFolder: getPostgresMigrationsFolder(),
  });
  migrated = true;
}
