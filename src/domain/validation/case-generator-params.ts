import type { OpenApiParameter } from "@/src/domain/openapi/endpoints";
import type { PlaygroundEndpoint } from "@/src/domain/openapi/endpoints";
import type { ValidationCase } from "@/src/domain/validation/types";
import { endpointKey } from "@/src/domain/validation/types";
import { repeatChar } from "@/src/domain/validation/utils";

const NOISY_PAYLOAD = "'; DROP TABLE users; --";

export function generateParamValidationCases(
  endpoint: PlaygroundEndpoint,
  baselineParams: Record<string, string>,
  parameters: OpenApiParameter[],
  includeNoisyVariants: boolean
): Omit<ValidationCase, "id" | "headers" | "body">[] {
  const cases: Omit<ValidationCase, "id" | "headers" | "body">[] = [];
  const ek = endpointKey(endpoint);

  for (const param of parameters) {
    if (param.in !== "path" && param.in !== "query") continue;
    const category = param.in === "path" ? ("path" as const) : ("query" as const);
    const name = param.name;
    const schema = param.schema ?? {};
    const type = schema.type ?? "string";
    const format = schema.format;

    const push = (
      variant: string,
      title: string,
      description: string,
      mutate: (base: Record<string, string>) => Record<string, string>,
      omitParam?: string
    ) => {
      cases.push({
        endpointKey: ek,
        path: endpoint.path,
        method: endpoint.method,
        controller: endpoint.controller,
        category,
        fieldPath: name,
        variant,
        name: `${name} (${param.in}) - ${title}`,
        description,
        paramValues: mutate({ ...baselineParams }),
        omitParam,
      });
    };

    if (param.required) {
      cases.push({
        endpointKey: ek,
        path: endpoint.path,
        method: endpoint.method,
        controller: endpoint.controller,
        category,
        fieldPath: name,
        variant: "omit-required",
        name: `${name} (${param.in}) - Omit Required`,
        description: "Parameter omitted from request",
        paramValues: { ...baselineParams },
        omitParam: name,
      });
    }

    push("empty", "Empty Value", "empty string", (base) => ({
      ...base,
      [name]: "",
    }));

    push("null-string", "Null Literal", "null as string", (base) => ({
      ...base,
      [name]: "null",
    }));

    if (type === "integer" || type === "number") {
      push("not-a-number", "Not a Number", "abc", (base) => ({
        ...base,
        [name]: "abc",
      }));
      push("float", "Float for Integer", "1.5", (base) => ({
        ...base,
        [name]: "1.5",
      }));
      push("negative", "Negative", "-1", (base) => ({
        ...base,
        [name]: "-1",
      }));
      push("overflow", "Very Large", String(Number.MAX_SAFE_INTEGER), (base) => ({
        ...base,
        [name]: String(Number.MAX_SAFE_INTEGER),
      }));
    }

    if (type === "boolean") {
      push("not-boolean", "Invalid Boolean", "maybe", (base) => ({
        ...base,
        [name]: "maybe",
      }));
    }

    if (format === "uuid" || name.toLowerCase().endsWith("id")) {
      push("bad-uuid", "Invalid UUID", "bad-uuid", (base) => ({
        ...base,
        [name]: "not-a-valid-uuid",
      }));
      push("short-uuid", "Too Short", "123", (base) => ({
        ...base,
        [name]: "123",
      }));
    }

    if (type === "string" || !type) {
      push("long-value", "Very Long", "10k chars", (base) => ({
        ...base,
        [name]: repeatChar("x", 10_000),
      }));
      if (includeNoisyVariants) {
        push("noisy", "Noisy Payload", "SQL-like", (base) => ({
          ...base,
          [name]: NOISY_PAYLOAD,
        }));
      }
    }

    if (schema.enum && schema.enum.length > 0) {
      push("invalid-enum", "Invalid Enum", "not in enum", (base) => ({
        ...base,
        [name]: "__invalid_enum__",
      }));
    }
  }

  return cases;
}
