import { type NextRequest, NextResponse } from "next/server";
import { checkRouteAuth } from "@/lib/security/route-auth";
import { readBodyWithLimit, MAX_PROXY_BODY_BYTES } from "@/lib/security/outbound-headers";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

interface TestCase {
  name: string;
  description: string;
  category: "valid" | "invalid" | "security" | "edge";
  fields: Record<string, any>;
  expectedResponse: {
    status: number;
    message: string;
  };
  id?: string;
  generated?: boolean;
  timestamp?: string;
}

async function generateTestCases(
  requestBody: string,
  history: string[]
): Promise<TestCase[]> {
  if (!requestBody || typeof requestBody !== "string") {
    throw new Error("Invalid request body provided");
  }

  const prompt = `
As a testing expert, analyze this API request body and generate ALL possible test cases:
${requestBody}

STRICT RULES:
1. Use ONLY plain string values
2. NO string multiplication (e.g., NO "x" * 256)
3. NO JavaScript expressions or code
4. NO concatenation operations
5. Write out the full string for long values
6. Return ONE single JSON array

For long strings, write them out like this:
✓ "This is a long string written out fully"
✓ "aaaaaaaaaaaaaaaaaa" (for repeated characters)
✓ "test@example.com"

DO NOT use:
× "x" * 256
× String.repeat()
× "a".repeat(10)
× Array(n).join("x")

Format your response as ONE array:
[
  {
    "name": "Valid Input Test",
    "description": "Test with valid input values",
    "category": "valid",
    "fields": {
      "fieldName": "actual plain string value"
    },
    "expectedResponse": {
      "status": 200,
      "message": "Success message here"
    }
  }
]

Include test cases for:
- Valid data (happy path, short values, long values)
- Invalid data (missing fields, empty values, invalid formats)
- Security tests (SQL injection, XSS, special chars)
- Edge cases (max length, whitespace, boundaries)

Response must be ONE valid JSON array only. No headers, no sections, no explanations.`;

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3:latest",
      prompt,
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
    const json = JSON.parse(raw);
    jsonStr = json.response?.trim() || "";
  } catch (err) {
    throw new Error("Invalid JSON response from Ollama API");
  }

  const arrayStart = jsonStr.indexOf("[");
  const arrayEnd = jsonStr.lastIndexOf("]");
  if (arrayStart === -1 || arrayEnd === -1 || arrayStart >= arrayEnd) {
    throw new Error("No valid JSON array found in LLM response");
  }

  jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);

  // Sanitize and clean
  jsonStr = jsonStr
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  if (!jsonStr) {
    throw new Error("Generated JSON string is empty");
  }

  let parsed: TestCase[];
  try {
    console.log("Parsing cleaned JSON string:", jsonStr);
    parsed = JSON.parse(jsonStr);
  } catch (err) {
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

  const unique = validated.filter(
    (tc, i, arr) =>
      i ===
      arr.findIndex(
        (x) => JSON.stringify(x.fields) === JSON.stringify(tc.fields)
      )
  );

  return unique;
}

export async function POST(request: NextRequest) {
  const denied = checkRouteAuth(request);
  if (denied) return denied;

  if (process.env.ENABLE_LLAMA_GENERATE === "false") {
    return NextResponse.json({ error: "LLM generation is disabled" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { requestBody, history } = body;

    if (!requestBody || typeof requestBody !== "string") {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    try {
      readBodyWithLimit(requestBody, MAX_PROXY_BODY_BYTES);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Request body too large";
      return NextResponse.json({ error: message }, { status: 413 });
    }

    const testCases = await generateTestCases(requestBody, history || []);
    const summary = {
      valid: testCases.filter((t) => t.category === "valid").length,
      invalid: testCases.filter((t) => t.category === "invalid").length,
      security: testCases.filter((t) => t.category === "security").length,
      edge: testCases.filter((t) => t.category === "edge").length,
    };

    return NextResponse.json({
      testCases,
      count: testCases.length,
      message: `Successfully generated ${testCases.length} unique test cases`,
      categories: summary,
    });
  } catch (error) {
    console.error("Error in POST /generate-test-cases:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Ollama API") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
