export * from "./contracts";
export * from "./domain-types";
export * from "./postgres-spec-repository";
export * from "./postgres-endpoint-status-repository";
export * from "./postgres-spec-settings-repository";
export * from "./postgres-endpoint-notes-repository";
export * from "./postgres-flow-repository";
export * from "./postgres-environment-repository";
export * from "./postgres-flow-run-repository";
export * from "./postgres-step-result-repository";

import { postgresSpecRepository } from "./postgres-spec-repository";

export const specRepository = postgresSpecRepository;
