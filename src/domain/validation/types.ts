import type { Credential } from "@/lib/playground/credentials";
import type { PlaygroundEndpoint } from "@/src/domain/openapi/endpoints";

/** Field name or dot-path → real value used as baseline before mutations. */
export type OverrideMap = Record<string, string>;

/** Global defaults + per-endpoint overrides (endpoint wins on collision). */
export type ValidationOverridesStore = {
  global: OverrideMap;
  byEndpoint: Record<string, OverrideMap>;
};

export const EMPTY_OVERRIDES_STORE: ValidationOverridesStore = {
  global: {},
  byEndpoint: {},
};

export type PassPolicy =
  | { kind: "4xx" }
  | { kind: "strict-400" }
  | { kind: "4xx-or-422" }
  | { kind: "custom-range"; min: number; max: number };

export type ValidationCaseCategory =
  | "baseline"
  | "body"
  | "path"
  | "query"
  | "header";

export type ValidationCase = {
  id: string;
  endpointKey: string;
  path: string;
  method: string;
  controller: string;
  category: ValidationCaseCategory;
  fieldPath: string;
  variant: string;
  name: string;
  description: string;
  paramValues: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
  /** Omit this path/query param from the request entirely. */
  omitParam?: string;
  /** Omit this header from the request entirely. */
  omitHeader?: string;
  isBaseline?: boolean;
};

/** Partial case before assignCaseIds merges defaults for headers/body/params. */
export type ValidationCaseDraft = Omit<
  ValidationCase,
  "id" | "headers" | "body" | "paramValues"
> & {
  headers?: Record<string, string>;
  body?: unknown;
  paramValues?: Record<string, string>;
};

export type ValidationOutcome = "pass" | "fail" | "error" | "skipped";

export type ValidationResult = {
  caseId: string;
  endpointKey: string;
  path: string;
  method: string;
  controller: string;
  category: ValidationCaseCategory;
  fieldPath: string;
  variant: string;
  name: string;
  status: number;
  statusText?: string;
  ok: boolean;
  outcome: ValidationOutcome;
  latencyMs: number;
  error?: string;
  responseBodyPreview?: string;
  requestPreview?: string;
  skipped?: string;
};

export type ValidationSuiteConfig = {
  concurrency: number;
  passPolicy: PassPolicy;
  includeNoisyVariants: boolean;
  perEndpointCap: number;
};

export const DEFAULT_VALIDATION_CONFIG: ValidationSuiteConfig = {
  concurrency: 10,
  passPolicy: { kind: "4xx" },
  includeNoisyVariants: true,
  perEndpointCap: 80,
};

export type ValidationSuiteOptions = {
  specId?: string;
  endpoints: PlaygroundEndpoint[];
  baseUrl: string;
  credential: Credential | null;
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
  };
  overrides: ValidationOverridesStore;
  config: ValidationSuiteConfig;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, latest: ValidationResult) => void;
};

export type EndpointValidationSuite = {
  endpoint: PlaygroundEndpoint;
  cases: ValidationCase[];
  skippedReason?: string;
};

export function endpointKey(ep: { method: string; path: string }): string {
  return `${ep.method.toUpperCase()}:${ep.path}`;
}
