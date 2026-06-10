import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getTaskModelsCatalog,
  resolveTaskModel,
} from "@/domain/ai/model-task-routing";

const keys = [
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "OPENAI_CHAT_MODEL",
  "GROQ_CHAT_MODEL",
  "AI_CHAT_DEFAULT_PROVIDER",
  "AI_RAG_QUERY_PROVIDER",
  "AI_RAG_QUERY_MODEL",
  "AI_AGENT_TOOL_PROVIDER",
  "AI_AGENT_TOOL_MODEL",
  "OPENAI_EMBEDDING_MODEL",
] as const;

const envSnapshot: Partial<Record<(typeof keys)[number], string | undefined>> =
  {};

describe("model-task-routing", () => {
  beforeEach(() => {
    for (const key of keys) {
      envSnapshot[key] = process.env[key];
      delete process.env[key];
    }
    process.env.GROQ_API_KEY = "gsk-test";
    process.env.GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
    process.env.GROQ_CHAT_MODELS =
      "llama-3.3-70b-versatile,llama-3.1-8b-instant";
    process.env.AI_CHAT_DEFAULT_PROVIDER = "groq";
  });

  afterEach(() => {
    for (const key of keys) {
      if (envSnapshot[key] === undefined) delete process.env[key];
      else process.env[key] = envSnapshot[key];
    }
  });

  it("answer task uses UI selection when valid", () => {
    const resolved = resolveTaskModel("answer", {
      provider: "groq",
      model: "llama-3.1-8b-instant",
    });
    assert.equal(resolved.task, "answer");
    assert.equal(resolved.provider, "groq");
    assert.equal(resolved.model, "llama-3.1-8b-instant");
  });

  it("tool_loop uses env when configured", () => {
    process.env.AI_AGENT_TOOL_PROVIDER = "groq";
    process.env.AI_AGENT_TOOL_MODEL = "llama-3.3-70b-versatile";
    const resolved = resolveTaskModel("tool_loop");
    assert.equal(resolved.provider, "groq");
    assert.equal(resolved.model, "llama-3.3-70b-versatile");
  });

  it("rag_query returns null in catalog when env unset", () => {
    const catalog = getTaskModelsCatalog();
    assert.equal(catalog.ragQuery, null);
    assert.equal(catalog.toolLoop.provider, "groq");
  });

  it("rag_query appears in catalog when env set", () => {
    process.env.AI_RAG_QUERY_PROVIDER = "groq";
    process.env.AI_RAG_QUERY_MODEL = "llama-3.1-8b-instant";
    const catalog = getTaskModelsCatalog();
    assert.ok(catalog.ragQuery);
    assert.equal(catalog.ragQuery?.model, "llama-3.1-8b-instant");
  });

  it("embedding uses OPENAI_EMBEDDING_MODEL override", () => {
    process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";
    const resolved = resolveTaskModel("embedding");
    assert.equal(resolved.model, "text-embedding-3-large");
  });
});
