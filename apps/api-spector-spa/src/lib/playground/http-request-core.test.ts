import { describe, expect, it } from "vitest";
import { normalizeRequestUrl } from "./http-request-core";

describe("normalizeRequestUrl", () => {
  it("keeps localhost in browser mode", () => {
    expect(
      normalizeRequestUrl("http://localhost:8080/api/v1/users/health", {
        preferIpv4: false,
      })
    ).toBe("http://localhost:8080/api/v1/users/health");
  });

  it("rewrites localhost for server-side proxy", () => {
    expect(
      normalizeRequestUrl("http://localhost:8080/api", { preferIpv4: true })
    ).toBe("http://127.0.0.1:8080/api");
  });
});
