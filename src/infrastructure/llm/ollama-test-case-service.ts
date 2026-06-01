import type {
  GeneratedTestCase,
  TestCaseCategorySummary,
} from "./types";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

function buildTestCasePrompt(requestBody: string): string {
  return `
As a testing expert, analyze this API request body and generate ALL possible test cases:
${requestBody}

STRICT RULES:
1. Use ONLY plain string values
2. NO string multiplication (e.g., NO "x" * 256)
3. NO JavaScript expressions or code
4. NO concatenation operations
5. Write out the full string for long values
6. Return ONE single JSON array

Format your response as ONE array of test case objects with name, description, category, fields, and expectedResponse.

Include test cases for valid data, invalid data, security tests, and edge cases.

Response must be ONE valid JSON array only. No headers, no sections, no explanations.`;
}

export async function generateTestCasesFromOllama(
  requestBody: string,
  _history: string[] = []
): Promise<GeneratedTestCase[]> {
  if (!requestBody || typeof requestBody !== "string") {
    throw new Error("Invalid request body provided");
  }

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3:latest",
      prompt: buildTestCasePrompt(requestBody),
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.95,
        top_k: 50,
        num_predict: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Ollama API error: ${response.status} ${response.statusText}: ${errText}`
    );
  }

  const raw = await response.text();
  let jsonStr = "";

  try {
    const json = JSON.parse(raw) as { response?: string };
    jsonStr = json.response?.trim() || "";
  } catch {
    throw new Error("Invalid JSON response from Ollama API");
  }

  const arrayStart = jsonStr.indexOf("[");
  const arrayEnd = jsonStr.lastIndexOf("]");
  if (arrayStart === -1 || arrayEnd === -1 || arrayStart >= arrayEnd) {
    throw new Error("No valid JSON array found in LLM response");
  }

  jsonStr = jsonStr
    .slice(arrayStart, arrayEnd + 1)
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  if (!jsonStr) {
    throw new Error("Generated JSON string is empty");
  }

  let parsed: GeneratedTestCase[];
  try {
    parsed = JSON.parse(jsonStr) as GeneratedTestCase[];
  } catch {
    throw new Error("Failed to parse cleaned test cases JSON");
  }

  const validated = parsed
    .filter((tc, idx) => {
      const valid = tc.name && tc.description && tc.fields;
      if (!valid) console.warn(`Skipping invalid test case at index ${idx}`);
      return valid;
    })
    .map((tc, idx) => ({
      ...tc,
      id: `tc_${Date.now()}_${idx}`,
      generated: true,
      timestamp: new Date().toISOString(),
    }));

  return validated.filter(
    (tc, i, arr) =>
      i ===
      arr.findIndex(
        (x) => JSON.stringify(x.fields) === JSON.stringify(tc.fields)
      )
  );
}

export function summarizeTestCaseCategories(
  testCases: GeneratedTestCase[]
): TestCaseCategorySummary {
  return {
    valid: testCases.filter((t) => t.category === "valid").length,
    invalid: testCases.filter((t) => t.category === "invalid").length,
    security: testCases.filter((t) => t.category === "security").length,
    edge: testCases.filter((t) => t.category === "edge").length,
  };
}
