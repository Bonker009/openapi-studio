/** JSON schemas for OpenAI Responses strict structured output. */
export const FLOW_SCHEMA_JSON_SCHEMA = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["REQUEST"] },
          name: { type: "string" },
          endpoint: { type: "string" },
        },
        required: ["id", "type", "name", "endpoint"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: { type: "string", enum: ["success", "failure", "always"] },
        },
        required: ["from", "to", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["nodes", "edges"],
  additionalProperties: false,
} as const;

export const QA_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    citedEndpoints: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["answer", "citedEndpoints"],
  additionalProperties: false,
} as const;
