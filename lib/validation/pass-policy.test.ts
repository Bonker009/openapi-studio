import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyOutcome,
  statusMatchesPassPolicy,
} from "@/lib/validation/pass-policy";

describe("pass-policy", () => {
  it("4xx policy accepts 400-499", () => {
    assert.equal(statusMatchesPassPolicy(400, { kind: "4xx" }), true);
    assert.equal(statusMatchesPassPolicy(422, { kind: "4xx" }), true);
    assert.equal(statusMatchesPassPolicy(200, { kind: "4xx" }), false);
  });

  it("strict-400 only accepts 400", () => {
    assert.equal(statusMatchesPassPolicy(400, { kind: "strict-400" }), true);
    assert.equal(statusMatchesPassPolicy(422, { kind: "strict-400" }), false);
  });

  it("classifyOutcome treats 4xx as pass for default policy", () => {
    assert.equal(classifyOutcome(400, false, { kind: "4xx" }), "pass");
    assert.equal(classifyOutcome(200, false, { kind: "4xx" }), "fail");
    assert.equal(classifyOutcome(500, false, { kind: "4xx" }), "error");
    assert.equal(classifyOutcome(0, true, { kind: "4xx" }), "error");
  });
});
