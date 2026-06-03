import type {
  AIDocumentationAssistant,
  AIFlowGenerator,
  AIPlanner,
  FixFlowInput,
  GeneratorInput,
  PlannerInput,
} from "@/domain/ai/contracts";
import {
  FLOW_SCHEMA_JSON_SCHEMA,
  QA_RESPONSE_JSON_SCHEMA,
} from "@/domain/ai/schemas/openai-json-schemas";
import type { DocumentationAnswerInput } from "@/domain/ai/contracts";
import type { FlowSchema, QAOutput } from "@/domain/ai/types";
import { normalizeEndpointRef } from "@/domain/ai/validation/endpoint-catalog";
import {
  buildDocumentationPrompt,
} from "@/domain/ai/prompts/documentation-prompt-builder";
import {
  buildFlowFixPrompt,
  buildFlowGeneratorPrompt,
  buildPlannerPrompt,
} from "@/domain/ai/prompts/flow-generation-prompt-builder";
import { buildDiffExplanationPrompt } from "@/domain/ai/prompts/diff-explanation-prompt-builder";
import type { DiffInput } from "@/domain/ai/types";
import {
  responsesJson,
  responsesText,
} from "@/infrastructure/ai/openai-client";
import { withAiRetry } from "@/infrastructure/ai/retry";

const PLANNER_INSTRUCTIONS =
  "You plan API test flows. Output numbered steps only. Use only listed endpoints.";

const GENERATOR_INSTRUCTIONS =
  "You output strict JSON for API test flows. Only use allowed endpoints. No prose.";

const FIXER_INSTRUCTIONS =
  "You fix invalid flow JSON. Return corrected JSON matching the schema. No prose.";

const DOC_INSTRUCTIONS =
  "You answer OpenAPI questions using only provided context. Return JSON with answer and citedEndpoints.";

const DIFF_INSTRUCTIONS =
  "You explain OpenAPI spec diffs clearly for engineers.";

export class OpenAiPlanner implements AIPlanner {
  async createPlan(input: PlannerInput): Promise<string> {
    const prompt = buildPlannerPrompt({
      userIntent: input.userIntent,
      allowedEndpoints: input.allowedEndpoints,
      contextBlocks: input.contextBlocks,
    });
    return withAiRetry(() =>
      responsesText({
        instructions: PLANNER_INSTRUCTIONS,
        prompt,
      })
    );
  }
}

export class OpenAiFlowGenerator implements AIFlowGenerator {
  async generateFlowJson(input: GeneratorInput): Promise<FlowSchema> {
    const prompt = buildFlowGeneratorPrompt({
      plan: input.plan,
      allowedEndpoints: input.allowedEndpoints,
      contextBlocks: input.contextBlocks,
    });
    return withAiRetry(() =>
      responsesJson<FlowSchema>({
        instructions: GENERATOR_INSTRUCTIONS,
        input: prompt,
        schemaName: "flow_schema",
        schema: FLOW_SCHEMA_JSON_SCHEMA,
      })
    );
  }

  async fixFlowJson(input: FixFlowInput): Promise<FlowSchema> {
    const prompt = buildFlowFixPrompt({
      invalidJson: JSON.stringify(input.invalidFlow),
      errors: input.validationErrors,
      allowedEndpoints: input.allowedEndpoints,
      contextBlocks: input.contextBlocks,
    });
    return withAiRetry(() =>
      responsesJson<FlowSchema>({
        instructions: FIXER_INSTRUCTIONS,
        input: prompt,
        schemaName: "flow_schema",
        schema: FLOW_SCHEMA_JSON_SCHEMA,
      })
    );
  }
}

export class OpenAiDocumentationAssistant implements AIDocumentationAssistant {
  async answer(input: DocumentationAnswerInput): Promise<QAOutput> {
    const prompt = buildDocumentationPrompt({
      question: input.question,
      allowedEndpoints: input.allowedEndpoints,
      contextBlocks: input.contextBlocks,
      history: input.history,
    });
    const parsed = await withAiRetry(() =>
      responsesJson<{ answer: string; citedEndpoints: string[] }>({
        instructions: DOC_INSTRUCTIONS,
        input: prompt,
        schemaName: "documentation_answer",
        schema: QA_RESPONSE_JSON_SCHEMA,
        chat: {
          provider: input.chatProvider,
          model: input.chatModel,
        },
      })
    );
    const allowed = new Set(input.allowedEndpoints);
    const citedEndpoints = (parsed.citedEndpoints ?? []).filter((ep) => {
      const key = normalizeEndpointRef(ep);
      return allowed.has(key) || allowed.has(ep);
    });
    return {
      answer: parsed.answer?.trim() || "No answer could be generated from context.",
      citedEndpoints,
      retrievedChunks: [],
    };
  }
}

export async function explainOpenApiDiff(input: DiffInput): Promise<string> {
  const prompt = buildDiffExplanationPrompt({
    beforeSummary: input.beforeSummary,
    afterSummary: input.afterSummary,
  });
  return withAiRetry(() =>
    responsesText({
      instructions: DIFF_INSTRUCTIONS,
      prompt,
    })
  );
}

export const openAiPlanner = new OpenAiPlanner();
export const openAiFlowGenerator = new OpenAiFlowGenerator();
export const openAiDocumentationAssistant = new OpenAiDocumentationAssistant();
