import type { DiffSummary } from "@/domain/diff/openapi-diff";

export type HistoryEntry = {
  ts: string;
  version: string;
  note?: string;
  summary?: DiffSummary;
  isRestore?: boolean;
};

export type EndpointStatusRow = {
  path: string;
  method: string;
  working: boolean;
  notes: string;
};

export type SpecSettingsData = {
  expandedControllers: Record<string, boolean>;
};

export type EndpointNoteRow = {
  id: number;
  specId: string;
  path: string;
  method: string;
  ts: number;
  kind: string;
  body: string;
};
