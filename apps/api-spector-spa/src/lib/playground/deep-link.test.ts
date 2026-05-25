import { describe, expect, it } from "vitest";
import {
  endpointToHash,
  findEndpointByHash,
  hashToEndpointKey,
} from "./deep-link";
import type { PlaygroundEndpoint } from "./endpoints";

const endpoints: PlaygroundEndpoint[] = [
  {
    path: "/api/v1/users/{id}",
    method: "GET",
    controller: "User",
    parameters: [],
    hasRequestBody: false,
    requiresAuth: false,
  },
];

describe("deep-link hash", () => {
  it("round-trips method and path", () => {
    const hash = endpointToHash("GET", "/api/v1/users/{id}");
    expect(hash).toBe("GET-api-v1-users-{id}");
    const key = hashToEndpointKey(`#${hash}`);
    expect(key).toEqual({ method: "GET", path: "/api/v1/users/{id}" });
  });

  it("finds endpoint from hash", () => {
    const found = findEndpointByHash(endpoints, "#GET-api-v1-users-{id}");
    expect(found?.path).toBe("/api/v1/users/{id}");
  });
});
