import path from "path";
import type { DiffSummary } from "@/lib/openapi-diff";
import { DATA_DIR } from "@/lib/db/client";

export const SPECS_DIR = path.join(DATA_DIR, "specs");
export const STATUS_DIR = path.join(DATA_DIR, "status");
export const SETTINGS_DIR = path.join(DATA_DIR, "settings");

export type { HistoryEntry } from "@/lib/db/repositories";

export {
  validateSpecId,
  readHistory,
  saveSpecVersion,
  readSpecSnapshot,
  deleteSpecFully,
  deleteVersionSnapshot,
  listCanonicalSpecIds,
  specExists,
  getSpec,
  listSpecSummaries,
  getEndpointStatuses,
  saveEndpointStatuses,
  deleteEndpointStatuses,
  getSpecSettings,
  saveSpecSettings,
  deleteSpecSettings,
} from "@/lib/db/repositories";

/** @deprecated File-based paths; kept for import script and legacy migration only. */
export function specCanonicalPath(id: string): string {
  return path.join(SPECS_DIR, `${id}.json`);
}

/** @deprecated File-based paths; kept for import script only. */
export function specDir(id: string): string {
  return path.join(SPECS_DIR, id);
}

/** @deprecated File-based paths; kept for import script only. */
export function versionsDir(id: string): string {
  return path.join(specDir(id), "versions");
}

/** @deprecated File-based paths; kept for import script only. */
export function historyPath(id: string): string {
  return path.join(specDir(id), "history.json");
}

/** @deprecated File-based paths; kept for import script only. */
export function versionSnapshotPath(id: string, ts: string): string {
  return path.join(versionsDir(id), `${ts}.json`);
}

/** No-op: history is stored in spec_versions table. */
export function writeHistory(
  _id: string,
  _entries: import("@/lib/db/repositories").HistoryEntry[]
): void {
  /* legacy API — not used after SQLite migration */
}

/** No-op: legacy file migration handled by db:import script. */
export function migrateLegacyVersions(_id: string): void {
  /* legacy API — not used after SQLite migration */
}

export type SaveSpecMeta = {
  note?: string;
  summary?: DiffSummary;
  isRestore?: boolean;
};
