import type {
  DiffInput,
  FlowSchema,
  GenerateFlowInput,
  GenerateFlowOutput,
  QAInput,
  QAOutput,
} from "@/domain/ai/types";

export type PlannerInput = {
  specId: string;
  userIntent: string;
  allowedEndpoints: string[];
  contextBlocks: string[];
};

export type GeneratorInput = {
  specId: string;
  plan: string;
  allowedEndpoints: string[];
  contextBlocks: string[];
};

export type FixFlowInput = {
  specId: string;
  invalidFlow: FlowSchema;
  validationErrors: string[];
  allowedEndpoints: string[];
  contextBlocks: string[];
};

export interface AIProvider {
  generateFlow(input: GenerateFlowInput): Promise<GenerateFlowOutput>;
  explainDiff(input: DiffInput): Promise<string>;
  answerQuestion(input: QAInput): Promise<QAOutput>;
}

export interface AIPlanner {
  createPlan(input: PlannerInput): Promise<string>;
}

export interface AIFlowGenerator {
  generateFlowJson(input: GeneratorInput): Promise<FlowSchema>;
  fixFlowJson(input: FixFlowInput): Promise<FlowSchema>;
}

export type DocumentationAnswerInput = QAInput & {
  allowedEndpoints: string[];
  contextBlocks: string[];
};

export interface AIDocumentationAssistant {
  answer(input: DocumentationAnswerInput): Promise<QAOutput>;
}
