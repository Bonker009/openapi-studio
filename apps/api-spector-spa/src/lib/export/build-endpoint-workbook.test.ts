import { describe, expect, it } from "vitest";
import {
  buildEndpointRows,
  buildEndpointWorkbookSheets,
  buildSchemaRows,
} from "./build-endpoint-workbook";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";

const sampleEndpoints: PlaygroundEndpoint[] = [
  {
    path: "/api/v1/users/{id}",
    method: "GET",
    controller: "User",
    summary: "Get user",
    parameters: [{ name: "id", in: "path", required: true }],
    hasRequestBody: false,
    requiresAuth: false,
  },
];

const sampleApiData = {
  paths: {
    "/api/v1/users/{id}": {
      get: {
        tags: ["User"],
        summary: "Get user",
        parameters: [{ name: "id", in: "path", required: true }],
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: { type: "object", properties: { name: { type: "string" } } },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      UserDto: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Display name" },
        },
      },
    },
  },
};

describe("buildEndpointWorkbookSheets", () => {
  it("includes Endpoints sheet with rows", () => {
    const sheets = buildEndpointWorkbookSheets(sampleEndpoints, sampleApiData);
    expect(sheets[0].name).toBe("Endpoints");
    expect(sheets[0].rows.length).toBe(1);
    expect(sheets[0].rows[0].method).toBe("GET");
    expect(sheets[0].rows[0].path).toBe("/api/v1/users/{id}");
  });

  it("includes Schemas sheet when components exist", () => {
    const sheets = buildEndpointWorkbookSheets(sampleEndpoints, sampleApiData);
    expect(sheets.some((s) => s.name === "Schemas")).toBe(true);
    const schemaSheet = sheets.find((s) => s.name === "Schemas");
    expect(schemaSheet?.rows.length).toBeGreaterThan(0);
  });
});

describe("buildEndpointRows", () => {
  it("marks auth required", () => {
    const rows = buildEndpointRows(
      [{ ...sampleEndpoints[0], requiresAuth: true }],
      sampleApiData
    );
    expect(rows[0].authRequired).toBe("Yes");
  });
});

describe("buildSchemaRows", () => {
  it("flattens schema properties", () => {
    const rows = buildSchemaRows(sampleApiData);
    expect(rows.some((r) => r.schema === "UserDto" && r.property === "name")).toBe(
      true
    );
  });
});
