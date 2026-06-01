import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatMultipartBodyHint,
  getRequestBodyInfo,
  pickRequestBodyContent,
} from "@/src/domain/openapi/request-body";

describe("pickRequestBodyContent", () => {
  it("prefers multipart over JSON when both exist", () => {
    const picked = pickRequestBodyContent({
      "application/json": { schema: { type: "object" } },
      "multipart/form-data": {
        schema: {
          type: "object",
          properties: { file: { type: "string", format: "binary" } },
        },
      },
    });
    assert.equal(picked?.mediaType, "multipart/form-data");
  });
});

describe("getRequestBodyInfo", () => {
  it("detects multipart file fields", () => {
    const info = getRequestBodyInfo(
      {
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  name: { type: "string" },
                },
                required: ["file"],
              },
            },
          },
        },
      },
      undefined
    );
    assert.equal(info.kind, "multipart");
    assert.deepEqual(info.multipartFields, [
      { name: "file", required: true, isFile: true, description: undefined },
      { name: "name", required: false, isFile: false, description: undefined },
    ]);
  });

  it("detects binary octet-stream", () => {
    const info = getRequestBodyInfo(
      {
        requestBody: {
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
      },
      undefined
    );
    assert.equal(info.kind, "binary");
  });

  it("returns none when no request body", () => {
    assert.equal(getRequestBodyInfo(null, undefined).kind, "none");
  });
});

describe("formatMultipartBodyHint", () => {
  it("formats field list for samples", () => {
    const hint = formatMultipartBodyHint([
      { name: "file", required: true, isFile: true },
      { name: "title", required: false, isFile: false },
    ]);
    assert.match(hint, /file: file \(binary\) \(required\)/);
    assert.match(hint, /title: text \(optional\)/);
  });
});
