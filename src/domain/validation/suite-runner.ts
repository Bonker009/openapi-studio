import {
  buildAllValidationSuites,
  flattenValidationCases,
} from "@/src/domain/validation/case-builder";
import { runValidationCase } from "@/src/domain/validation/case-runner";
import type {
  EndpointValidationSuite,
  ValidationResult,
  ValidationSuiteOptions,
} from "@/src/domain/validation/types";

export type ValidationRunSummary = {
  results: ValidationResult[];
  suites: EndpointValidationSuite[];
  totalCases: number;
};

export async function runValidationSuite(
  opts: ValidationSuiteOptions
): Promise<ValidationRunSummary> {
  const suites = buildAllValidationSuites(
    opts.endpoints,
    opts.apiData,
    opts.overrides,
    opts.config
  );
  const totalCases = flattenValidationCases(suites).length;
  const results: ValidationResult[] = [];
  let suiteIndex = 0;
  let done = 0;
  const concurrency = Math.max(
    1,
    Math.min(opts.config.concurrency, suites.length || 1)
  );

  async function worker() {
    while (true) {
      if (opts.signal?.aborted) return;
      const i = suiteIndex++;
      if (i >= suites.length) return;

      const suite = suites[i];
      if (suite.skippedReason) continue;

      for (const testCase of suite.cases) {
        if (opts.signal?.aborted) return;
        const result = await runValidationCase(testCase, {
          baseUrl: opts.baseUrl,
          credential: opts.credential,
          endpoint: suite.endpoint,
          passPolicy: opts.config.passPolicy,
          apiData: opts.apiData,
        });
        results.push(result);
        done++;
        opts.onProgress?.(done, totalCases, result);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { results, suites, totalCases };
}
