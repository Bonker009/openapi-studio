import type { DiffSummary } from "@/domain/diff/openapi-diff";
import type {
  Flow,
  FlowStep,
  StepRunResult,
} from "@/domain/flows/types";
import type {
  EndpointStatusRow,
  EndpointNoteRow,
  HistoryEntry,
  SpecSettingsData,
} from "./domain-types";

export type {
  EndpointStatusRow,
  EndpointNoteRow,
  HistoryEntry,
  SpecSettingsData,
};

export type SpecListItem = {
  id: string;
  title: string;
  description?: string;
  version: string;
  lastModified: string;
};

export type ApiSpecification = Record<string, unknown>;

export interface SpecRepository {
  findAll(): Promise<SpecListItem[]>;
  findById(id: string): Promise<ApiSpecification | null>;
  exists(id: string): Promise<boolean>;
  saveVersion(
    id: string,
    data: ApiSpecification,
    meta?: { note?: string; summary?: DiffSummary; isRestore?: boolean }
  ): Promise<string>;
  delete(id: string): Promise<void>;
  readHistory(id: string): Promise<HistoryEntry[]>;
  readSnapshot(id: string, ts: string): Promise<ApiSpecification | null>;
  deleteVersion(id: string, ts: string): Promise<void>;
}

export interface EndpointStatusRepository {
  findBySpecId(specId: string): Promise<EndpointStatusRow[] | null>;
  save(specId: string, rows: EndpointStatusRow[]): Promise<void>;
  delete(specId: string): Promise<void>;
}

export interface SpecSettingsRepository {
  findBySpecId(specId: string): Promise<SpecSettingsData | null>;
  save(specId: string, data: SpecSettingsData): Promise<void>;
  delete(specId: string): Promise<void>;
}

export type FlowListQuery = {
  specId: string;
};

export type SaveFlowInput = {
  flow: Flow;
};

export interface FlowRepository {
  findBySpecId(query: FlowListQuery): Promise<Flow[]>;
  findById(specId: string, flowId: string): Promise<Flow | null>;
  save(input: SaveFlowInput): Promise<Flow>;
  delete(specId: string, flowId: string): Promise<boolean>;
}

export type PersistedFlowStep = FlowStep & {
  dbId: string;
  flowDbId: string;
  stepKey: string;
  orderIndex: number;
};

export interface StepRepository {
  findByFlowDbId(flowDbId: string): Promise<PersistedFlowStep[]>;
}

export type FlowEnvironmentRecord = {
  id: string;
  name: string;
  variables: Record<string, string>;
  createdAt: string;
};

export interface EnvironmentRepository {
  findById(id: string): Promise<FlowEnvironmentRecord | null>;
  findByName(name: string): Promise<FlowEnvironmentRecord | null>;
  upsert(name: string, variables: Record<string, string>): Promise<FlowEnvironmentRecord>;
}

export type FlowRunRecord = {
  id: string;
  flowId: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  summary: Record<string, unknown>;
};

export interface FlowRunRepository {
  createRun(record: Omit<FlowRunRecord, "id">): Promise<FlowRunRecord>;
}

export type StepResultMetadataRecord = {
  runId: string;
  stepId: string;
  status: StepRunResult["outcome"];
  durationMs: number;
  assertionResult: Record<string, unknown> | null;
  extractedValues: Record<string, unknown> | null;
  requestSummary: Record<string, unknown> | null;
  responseSummary: Record<string, unknown> | null;
  errorMessage: string | null;
};

export interface StepResultRepository {
  insertMany(records: StepResultMetadataRecord[]): Promise<void>;
}
