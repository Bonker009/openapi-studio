export interface RunTestCaseResult {
  status: number | string;
  ok: boolean;
  response: unknown;
}

export async function runTestCase(
  testCase: { body: Record<string, unknown>; expectedStatus?: number },
  apiUrl: string,
  method = "POST",
  token?: string
): Promise<RunTestCaseResult> {
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

    return { status, ok, response: data };
  } catch (error) {
    return {
      status: "error",
      ok: false,
      response: error instanceof Error ? error.message : String(error),
    };
  }
}
