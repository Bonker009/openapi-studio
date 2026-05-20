"use server";

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

    const response = await fetch(apiUrl, init);
    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // keep raw text
    }

    const status = response.status;
    const ok =
      testCase.expectedStatus != null
        ? status === testCase.expectedStatus
        : response.ok;

    return {
      name: testCase.name,
      status,
      ok,
      response: data,
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
