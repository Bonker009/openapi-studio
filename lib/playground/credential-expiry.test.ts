import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCredentialExpired } from "@/lib/playground/credential-expiry";
import type { Credential } from "@/lib/playground/credentials";

/** JWT with `"exp":1` (expired). */
const EXPIRED_JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid-signature";

describe("isCredentialExpired", () => {
  it("returns false for bearer tokens without JWT expiry", () => {
    const cred: Credential = {
      id: "1",
      name: "Plain",
      type: "bearer",
      token: "not-a-jwt",
    };
    assert.equal(isCredentialExpired(cred), false);
  });

  it("returns true for expired JWT bearer tokens", () => {
    const cred: Credential = {
      id: "2",
      name: "Jwt",
      type: "bearer",
      token: EXPIRED_JWT,
    };
    assert.equal(isCredentialExpired(cred), true);
  });

  it("returns true for OAuth credentials past expiresAt", () => {
    const cred: Credential = {
      id: "3",
      name: "OAuth",
      type: "oauth2cc",
      tokenUrl: "https://auth.example.com/token",
      clientId: "id",
      clientSecret: "secret",
      accessToken: "token",
      expiresAt: 1,
    };
    assert.equal(isCredentialExpired(cred), true);
  });

  it("returns false for OAuth credentials without expiresAt", () => {
    const cred: Credential = {
      id: "4",
      name: "OAuth pending",
      type: "oauth2cc",
      tokenUrl: "https://auth.example.com/token",
      clientId: "id",
      clientSecret: "secret",
    };
    assert.equal(isCredentialExpired(cred), false);
  });

  it("returns false for basic and apiKey credentials", () => {
    const basic: Credential = {
      id: "5",
      name: "Basic",
      type: "basic",
      username: "u",
      password: "p",
    };
    const apiKey: Credential = {
      id: "6",
      name: "Key",
      type: "apiKey",
      in: "header",
      paramName: "X-API-Key",
      value: "abc",
    };
    assert.equal(isCredentialExpired(basic), false);
    assert.equal(isCredentialExpired(apiKey), false);
  });
});
