/** Re-export declarative flow schema for UI and tooling. */
export type {
  FlowDefinition,
  DeclarativeStep,
  FlowCollection,
  FlowEnvironment,
  FlowExecutionMode,
  AssertionRule,
  ExtractionRule,
  DeclarativeRequest,
  DeclarativeAuth,
  StepUiMeta,
} from "@/domain/flows/types/schema";

export {
  legacyFlowToDefinition,
  definitionToLegacyFlow,
  legacyStepToDeclarative,
  declarativeStepToLegacy,
} from "@/domain/flows/services/flow-adapter";

export {
  validateFlowDefinition,
  validateLegacyFlowSchema,
  hasBlockingIssues,
  type FlowValidationIssue,
} from "@/domain/flows/services/flow-schema-validator";
