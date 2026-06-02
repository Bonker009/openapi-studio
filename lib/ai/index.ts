export { isAiModuleEnabled, aiFlowService, AiFlowService } from "@/features/ai/ai-flow-service";
export type {
  FlowSchema,
  GenerateFlowInput,
  GenerateFlowOutput,
  QAInput,
  QAOutput,
  IndexOpenApiInput,
  IndexOpenApiResult,
} from "@/domain/ai/types";
export { flowSchemaToInternalFlow } from "@/domain/ai/adapters/flow-contract-adapter";
export { validateFlowSchema } from "@/domain/ai/validation/flow-schema-validator";
export { buildEndpointCatalog } from "@/domain/ai/validation/endpoint-catalog";
