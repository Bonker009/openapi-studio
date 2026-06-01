import { type NextRequest, NextResponse } from "next/server";
import { checkRouteAuth } from "@/lib/security/route-auth";
import {
  readBodyWithLimit,
  MAX_PROXY_BODY_BYTES,
} from "@/lib/security/outbound-headers";
import {
  generateTestCasesFromOllama,
  summarizeTestCaseCategories,
} from "@/src/infrastructure/llm/ollama-test-case-service";
import { AppError } from "@/src/shared/errors/app-error";

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

    const testCases = await generateTestCasesFromOllama(
      requestBody,
      history || []
    );
    const categories = summarizeTestCaseCategories(testCases);

    return NextResponse.json({
      testCases,
      count: testCases.length,
      message: `Successfully generated ${testCases.length} unique test cases`,
      categories,
    });
  } catch (error) {
    console.error("Error in POST /api/llama-generate:", error);
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Ollama API") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
