"use server";

import { performHttpRequest } from "@/lib/playground/perform-http-request-server";

export interface TestCase {
  name: string;
  description: string;
  body: Record<string, unknown>;
  expectedStatus?: number;
}

export interface TestCaseResult {
  name: string;
  status: number | string;
  ok: boolean;
  response: unknown;
}

export async function runTestCase(
  testCase: TestCase,
  apiUrl: string,
  method = "POST",
  token?: string
): Promise<TestCaseResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token?.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    const upperMethod = method.toUpperCase();
    const init: RequestInit = { method: upperMethod, headers };

    if (
      upperMethod !== "GET" &&
      upperMethod !== "HEAD" &&
      testCase.body != null
    ) {
      init.body = JSON.stringify(testCase.body);
    }

    const result = await performHttpRequest(apiUrl, init);

    if (result.status === 0) {
      return {
        name: testCase.name,
        status: "error",
        ok: false,
        response: result.error ?? "Request failed",
      };
    }

    const status = result.status;
    const ok =
      testCase.expectedStatus != null
        ? status === testCase.expectedStatus
        : status >= 200 && status < 300;

    return {
      name: testCase.name,
      status,
      ok,
      response: result.data,
    };
  } catch (error) {
    return {
      name: testCase.name,
      status: "error",
      ok: false,
      response: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runTestCases(
  testCases: TestCase[],
  apiUrl: string,
  method = "POST",
  token?: string
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  for (const testCase of testCases) {
    results.push(await runTestCase(testCase, apiUrl, method, token));
  }
  return results;
}
