import { generateBodyValidationCases } from "@/lib/validation/case-generator-body";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";

type LegacyTestCase = {
  name: string;
  description: string;
  body: Record<string, unknown>;
  expectedStatus: number;
};

const DUMMY_ENDPOINT: PlaygroundEndpoint = {
  path: "/",
  method: "POST",
  controller: "default",
  parameters: [],
  hasRequestBody: true,
  requiresAuth: false,
};

/** @deprecated Use lib/validation case generators instead. */
export class TestCaseGenerator {
  static generateTestCases(
    requestBody: Record<string, unknown>
  ): LegacyTestCase[] {
    return generateBodyValidationCases(DUMMY_ENDPOINT, requestBody).map(
      (c) => ({
        name: c.name,
        description: c.description,
        body: (c.body ?? {}) as Record<string, unknown>,
        expectedStatus: 400,
      })
    );
  }
}
