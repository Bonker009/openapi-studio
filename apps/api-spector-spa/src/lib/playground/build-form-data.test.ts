import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFormData,
  createMultipartStateFromFields,
  validateMultipartState,
} from "@/lib/playground/build-form-data";

describe("buildFormData", () => {
  it("includes text and file parts", () => {
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const state = createMultipartStateFromFields([
      { name: "name", required: false, isFile: false },
      { name: "file", required: true, isFile: true },
    ]);
    state.rows[0].textValue = "demo";
    state.rows[1].file = file;

    const fd = buildFormData(state);
    assert.equal(fd.get("name"), "demo");
    const part = fd.get("file");
    assert.ok(part instanceof File);
    assert.equal((part as File).name, "test.txt");
  });
});

describe("validateMultipartState", () => {
  it("requires file fields marked required", () => {
    const state = createMultipartStateFromFields([
      { name: "file", required: true, isFile: true },
    ]);
    assert.match(validateMultipartState(state) ?? "", /file/);
    state.rows[0].file = new File(["x"], "a.bin");
    assert.equal(validateMultipartState(state), null);
  });
});
