import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getChatProviderCatalog,
  resolveChatRuntimeConfig,
  resolveChatSelection,
  resolveGroqBaseUrls,
  validateChatSelection,
} from "@/infrastructure/ai/chat-provider-config";

const keys = [
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "GROQ_BASE_URL",
  "OPENAI_CHAT_MODEL",
  "GROQ_CHAT_MODEL",
  "OPENAI_CHAT_MODELS",
  "GROQ_CHAT_MODELS",
  "AI_CHAT_DEFAULT_PROVIDER",
] as const;

const envSnapshot: Partial<Record<(typeof keys)[number], string | undefined>> =
  {};

describe("chat-provider-config", () => {
  beforeEach(() => {
    for (const key of keys) {
      envSnapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (envSnapshot[key] === undefined) delete process.env[key];
      else process.env[key] = envSnapshot[key];
    }
  });

  it("lists configured providers", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GROQ_API_KEY = "gsk-test";
    const catalog = getChatProviderCatalog();
    assert.equal(catalog.providers.length, 2);
    assert.ok(catalog.defaultProvider);
  });

  it("validates model belongs to provider", () => {
    process.env.GROQ_API_KEY = "gsk-test";
    process.env.GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
    assert.throws(() =>
      validateChatSelection({
        provider: "groq",
        model: "gpt-4o-mini",
      })
    );
  });

  it("resolves default when partial selection missing", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_CHAT_MODEL = "gpt-4o-mini";
    const resolved = resolveChatSelection();
    assert.equal(resolved.provider, "openai");
    assert.equal(resolved.model, "gpt-4o-mini");
  });

  it("normalizes Groq base URL for AI SDK vs groq-sdk", () => {
    assert.deepEqual(resolveGroqBaseUrls(), {
      aiSdkBaseUrl: "https://api.groq.com/openai/v1",
      groqSdkBaseUrl: "https://api.groq.com",
    });
    assert.deepEqual(
      resolveGroqBaseUrls("https://api.groq.com/openai/v1/"),
      {
        aiSdkBaseUrl: "https://api.groq.com/openai/v1",
        groqSdkBaseUrl: "https://api.groq.com",
      }
    );
    assert.deepEqual(resolveGroqBaseUrls("https://api.groq.com"), {
      aiSdkBaseUrl: "https://api.groq.com/openai/v1",
      groqSdkBaseUrl: "https://api.groq.com",
    });
  });

  it("exposes groqSdkBaseUrl for LangGraph when GROQ_BASE_URL includes /openai/v1", () => {
    process.env.GROQ_API_KEY = "gsk-test";
    process.env.GROQ_BASE_URL = "https://api.groq.com/openai/v1";
    const cfg = resolveChatRuntimeConfig({ provider: "groq" });
    assert.equal(cfg.baseUrl, "https://api.groq.com/openai/v1");
    assert.equal(cfg.groqSdkBaseUrl, "https://api.groq.com");
  });
});
