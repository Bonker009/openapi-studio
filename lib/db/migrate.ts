import path from "path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb } from "./client";

let migrated = false;

export function runMigrations(): void {
  if (migrated) return;
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  migrate(getDb(), { migrationsFolder });
  migrated = true;
}
