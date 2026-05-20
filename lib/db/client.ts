import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "app.db");

let sqlite: Database.Database | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** WAL needs POSIX shm; bind mounts (especially Docker Desktop on Windows) often fail with SQLITE_IOERR_SHMOPEN. */
function journalMode(): "WAL" | "DELETE" {
  const mode = process.env.SQLITE_JOURNAL_MODE?.toUpperCase();
  return mode === "DELETE" ? "DELETE" : "WAL";
}

function removeStaleWalSidecars(): void {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${DB_PATH}${suffix}`;
    if (fs.existsSync(sidecar)) {
      try {
        fs.unlinkSync(sidecar);
      } catch {
        /* another process may hold the file */
      }
    }
  }
}

export function getSqlite(): Database.Database {
  if (!sqlite) {
    ensureDataDir();
    const mode = journalMode();
    if (mode === "DELETE") {
      removeStaleWalSidecars();
    }
    sqlite = new Database(DB_PATH);
    sqlite.pragma(`journal_mode = ${mode}`);
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
  }
  return sqlite;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getSqlite(), { schema });
  }
  return dbInstance;
}
