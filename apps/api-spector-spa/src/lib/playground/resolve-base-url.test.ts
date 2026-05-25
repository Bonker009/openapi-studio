import { describe, expect, it } from "vitest";
import {
  isRelativeServerUrl,
  resolveDefaultBaseUrl,
  resolveServerBaseUrl,
} from "./resolve-base-url";

describe("resolveServerBaseUrl", () => {
  it("turns / into origin", () => {
    expect(resolveServerBaseUrl("/", "http://localhost:8080")).toBe(
      "http://localhost:8080"
    );
  });

  it("turns empty server url into origin", () => {
    expect(resolveServerBaseUrl("", "http://localhost:8080")).toBe(
      "http://localhost:8080"
    );
  });

  it("prefixes relative paths with origin", () => {
    expect(resolveServerBaseUrl("/api", "http://localhost:8080")).toBe(
      "http://localhost:8080/api"
    );
  });

  it("keeps absolute URLs", () => {
    expect(
      resolveServerBaseUrl("https://api.example.com/v1/", "http://localhost:8080")
    ).toBe("https://api.example.com/v1");
  });
});

describe("resolveDefaultBaseUrl", () => {
  it("prefers configured url", () => {
    expect(
      resolveDefaultBaseUrl({
        configuredUrl: "https://staging.example.com",
        servers: [{ url: "/" }],
        origin: "http://localhost:8080",
      })
    ).toBe("https://staging.example.com");
  });

  it("does not return empty string for / server", () => {
    expect(
      resolveDefaultBaseUrl({
        servers: [{ url: "/" }],
        origin: "http://localhost:8080",
      })
    ).toBe("http://localhost:8080");
  });
});

describe("isRelativeServerUrl", () => {
  it("detects relative paths", () => {
    expect(isRelativeServerUrl("/")).toBe(true);
    expect(isRelativeServerUrl("/api")).toBe(true);
    expect(isRelativeServerUrl("https://x.com")).toBe(false);
  });
});
