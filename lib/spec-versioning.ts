import type { DiffSummary } from "@/lib/openapi-diff";
import {
  postgresEndpointStatusRepository,
  postgresSpecRepository,
  postgresSpecSettingsRepository,
} from "@/infrastructure/repositories";

export type { HistoryEntry } from "@/infrastructure/repositories/domain-types";
export type { EndpointStatusRow, SpecSettingsData } from "@/infrastructure/repositories/domain-types";

export { validateSpecId } from "@/lib/spec-id";

export async function readHistory(id: string) {
  return postgresSpecRepository.readHistory(id);
}

export async function saveSpecVersion(
  id: string,
  data: Record<string, unknown>,
  meta?: { note?: string; summary?: DiffSummary; isRestore?: boolean }
) {
  return postgresSpecRepository.saveVersion(id, data, meta);
}

export async function readSpecSnapshot(id: string, ts: string) {
  return postgresSpecRepository.readSnapshot(id, ts);
}

export async function deleteSpecFully(id: string) {
  return postgresSpecRepository.delete(id);
}

export async function deleteVersionSnapshot(id: string, ts: string) {
  return postgresSpecRepository.deleteVersion(id, ts);
}

export async function listCanonicalSpecIds() {
  const items = await postgresSpecRepository.listSummaries();
  return items.map((i) => i.id);
}

export async function specExists(id: string) {
  return postgresSpecRepository.exists(id);
}

export async function getSpec(id: string) {
  return postgresSpecRepository.findById(id);
}

export async function listSpecSummaries() {
  return postgresSpecRepository.listSummaries();
}

export async function getEndpointStatuses(id: string) {
  return postgresEndpointStatusRepository.findBySpecId(id);
}

export async function saveEndpointStatuses(
  id: string,
  data: import("@/infrastructure/repositories/domain-types").EndpointStatusRow[]
) {
  return postgresEndpointStatusRepository.save(id, data);
}

export async function deleteEndpointStatuses(id: string) {
  return postgresEndpointStatusRepository.delete(id);
}

export async function getSpecSettings(id: string) {
  return postgresSpecSettingsRepository.findBySpecId(id);
}

export async function saveSpecSettings(
  id: string,
  data: import("@/infrastructure/repositories/domain-types").SpecSettingsData
) {
  return postgresSpecSettingsRepository.save(id, data);
}

export async function deleteSpecSettings(id: string) {
  return postgresSpecSettingsRepository.delete(id);
}

export type SaveSpecMeta = {
  note?: string;
  summary?: DiffSummary;
  isRestore?: boolean;
};
