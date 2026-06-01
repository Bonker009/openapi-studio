import type { OpenApiParameter } from "@/src/domain/openapi/endpoints";
import type { PlaygroundEndpoint } from "@/src/domain/openapi/endpoints";
import type { ValidationCase } from "@/src/domain/validation/types";
import { endpointKey } from "@/src/domain/validation/types";

export function generateHeaderValidationCases(
  endpoint: PlaygroundEndpoint,
  baselineParams: Record<string, string>,
  baselineHeaders: Record<string, string>,
  parameters: OpenApiParameter[]
): Omit<ValidationCase, "id" | "body">[] {
  const cases: Omit<ValidationCase, "id" | "body">[] = [];
  const ek = endpointKey(endpoint);

  for (const param of parameters) {
    if (param.in !== "header") continue;

    const name = param.name;
    const schema = param.schema ?? {};
    const type = schema.type ?? "string";

    const push = (
      variant: string,
      title: string,
      description: string,
      headers: Record<string, string>,
      omitHeader?: string
    ) => {
      cases.push({
        endpointKey: ek,
        path: endpoint.path,
        method: endpoint.method,
        controller: endpoint.controller,
        category: "header",
        fieldPath: name,
        variant,
        name: `Header ${name} - ${title}`,
        description,
        paramValues: { ...baselineParams },
        headers,
        omitHeader,
      });
    };

    if (param.required) {
      const omitted = { ...baselineHeaders };
      delete omitted[name];
      push(
        "omit-required",
        "Omit Required",
        "Header omitted",
        omitted,
        name
      );
    }

    push("empty", "Empty Value", "empty", {
      ...baselineHeaders,
      [name]: "",
    });

    push("null-string", "Null Literal", "null", {
      ...baselineHeaders,
      [name]: "null",
    });

    if (type === "integer" || type === "number") {
      push("not-a-number", "Not a Number", "abc", {
        ...baselineHeaders,
        [name]: "abc",
      });
    }

    if (schema.format === "uuid") {
      push("bad-uuid", "Invalid UUID", "bad", {
        ...baselineHeaders,
        [name]: "bad-uuid",
      });
    }
  }

  return cases;
}
