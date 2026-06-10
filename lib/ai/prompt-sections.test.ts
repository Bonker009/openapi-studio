import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PROMPT_VERSION,
  buildCitationRules,
  buildConversationSection,
  buildDbConnectionSection,
  buildEndpointCatalogSection,
  buildFollowUpResolutionRules,
  buildGroundingRules,
  buildToolResultsSection,
} from "@/domain/ai/prompts/prompt-sections";

describe("prompt-sections", () => {
  it("exports stable prompt version", () => {
    assert.equal(PROMPT_VERSION, "unified-v1");
  });

  it("builds conversation section with capped turns", () => {
    const lines = buildConversationSection(
      [
        { role: "user", content: "What is GET /users?" },
        { role: "assistant", content: "Returns users." },
      ],
      2
    );
    assert.ok(lines.some((l) => l.includes("Conversation so far")));
    assert.ok(lines.some((l) => l.includes("user:")));
  });

  it("includes follow-up and grounding rules", () => {
    const followUp = buildFollowUpResolutionRules().join("\n");
    const grounding = buildGroundingRules().join("\n");
    assert.match(followUp, /prior messages/i);
    assert.match(grounding, /Never invent endpoints/i);
    assert.ok(buildCitationRules().length > 0);
  });

  it("builds endpoint catalog with count", () => {
    const section = buildEndpointCatalogSection(["GET /a", "POST /b"]).join("\n");
    assert.match(section, /exactly 2 endpoints/);
    assert.match(section, /GET \/a/);
  });

  it("describes db connection states", () => {
    const off = buildDbConnectionSection({ connected: false }).join("\n");
    assert.match(off, /not connected/i);
    const on = buildDbConnectionSection({
      connected: true,
      indexed: true,
      label: "prod",
    }).join("\n");
    assert.match(on, /prod/);
    assert.match(on, /schema indexed/i);
  });

  it("truncates tool results to char cap", () => {
    const huge = "x".repeat(20_000);
    const section = buildToolResultsSection(
      [{ toolName: "search_api_docs", output: huge }],
      500
    ).join("\n");
    assert.ok(section.length < 600);
    assert.match(section, /search_api_docs/);
  });

  it("notes truncated tool output", () => {
    const section = buildToolResultsSection([
      { toolName: "execute_readonly_sql", output: "{}", truncated: true },
    ]).join("\n");
    assert.match(section, /truncated/i);
  });
});
