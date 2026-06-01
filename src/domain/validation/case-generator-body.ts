import type { ValidationCase } from "@/src/domain/validation/types";
import { endpointKey } from "@/src/domain/validation/types";
import type { PlaygroundEndpoint } from "@/src/domain/openapi/endpoints";
import {
  isDateField,
  isUuidString,
  repeatChar,
  setDeepValue,
} from "@/src/domain/validation/utils";

type BodyCaseDraft = {
  fieldPath: string;
  variant: string;
  name: string;
  description: string;
  body: Record<string, unknown>;
};

const EMAIL_INVALIDS: [string, unknown][] = [
  ["No At Symbol", "invalidemail"],
  ["No Domain", "invalid@"],
  ["Double At", "test@@example.com"],
  ["Empty", ""],
  ["Null", null],
  ["Space in Email", "test @example.com"],
  ["Missing TLD", "test@example"],
];

const UUID_INVALIDS: [string, unknown][] = [
  ["Empty String", ""],
  ["Too Short", "123"],
  ["Bad Format", "bad-uuid"],
  ["Number Instead", 123],
  ["Null", null],
];

const DATE_INVALIDS: [string, unknown][] = [
  ["Empty String", ""],
  ["Not a Date", "not-a-date"],
  ["Invalid Format", "32/13/2024"],
  ["Number Instead", 12345],
  ["Null", null],
  ["Invalid ISO Date", "2024-02-30T00:00:00Z"],
];

export function generateBodyValidationCases(
  endpoint: PlaygroundEndpoint,
  baselineBody: Record<string, unknown>
): Omit<ValidationCase, "id" | "paramValues" | "headers">[] {
  const drafts: BodyCaseDraft[] = [];
  const rootObj = baselineBody;

  const handleField = (obj: Record<string, unknown>, parent = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const path = parent ? `${parent}.${key}` : key;
      const valueType = Array.isArray(value)
        ? "array"
        : value === null
          ? "null"
          : typeof value;

      if (["string", "number", "boolean"].includes(valueType)) {
        pushPrimitiveCases(drafts, path, rootObj, valueType, key);
      }

      if (valueType === "array") {
        pushArrayCases(drafts, path, rootObj, value);
        if (
          Array.isArray(value) &&
          value.length > 0 &&
          typeof value[0] === "object" &&
          value[0] !== null
        ) {
          value.forEach((item, idx) =>
            handleField(item as Record<string, unknown>, `${path}[${idx}]`)
          );
        }
      }

      if (valueType === "object" && value !== null && !Array.isArray(value)) {
        pushObjectCases(drafts, path, rootObj, value as Record<string, unknown>);
        handleField(value as Record<string, unknown>, path);
      }

      if (key.toLowerCase().includes("mail") && valueType === "string") {
        pushInvalidVariants(drafts, path, rootObj, EMAIL_INVALIDS, "Invalid Email");
      }

      if (valueType === "string" && typeof value === "string" && isUuidString(value)) {
        pushInvalidVariants(drafts, path, rootObj, UUID_INVALIDS, "Invalid UUID");
      }

      if (valueType === "string" && typeof value === "string" && isDateField(key, value)) {
        pushInvalidVariants(drafts, path, rootObj, DATE_INVALIDS, "Invalid Date");
      }
    }
  };

  handleField(baselineBody);

  const ek = endpointKey(endpoint);
  return drafts.map((d) => ({
    endpointKey: ek,
    path: endpoint.path,
    method: endpoint.method,
    controller: endpoint.controller,
    category: "body" as const,
    fieldPath: d.fieldPath,
    variant: d.variant,
    name: d.name,
    description: d.description,
    body: d.body,
  }));
}

function draft(
  path: string,
  variant: string,
  name: string,
  description: string,
  rootObj: Record<string, unknown>,
  value: unknown
): BodyCaseDraft {
  return {
    fieldPath: path,
    variant,
    name,
    description,
    body: setDeepValue(rootObj, path, value),
  };
}

function pushPrimitiveCases(
  drafts: BodyCaseDraft[],
  path: string,
  rootObj: Record<string, unknown>,
  valueType: string,
  key: string
) {
  drafts.push(
    draft(path, "empty", `${path} - Empty Value`, "empty value", rootObj, ""),
    draft(path, "null", `${path} - Null Value`, "null", rootObj, null)
  );

  if (valueType === "string") {
    drafts.push(
      draft(path, "long-value", `${path} - Very Long Value`, "10k chars", rootObj, repeatChar("x", 10_000)),
      draft(path, "whitespace", `${path} - Whitespace Only`, "whitespace", rootObj, "   "),
      draft(path, "wrong-type-number", `${path} - Number Instead`, "number", rootObj, 12345),
      draft(path, "wrong-type-boolean", `${path} - Boolean Instead`, "boolean", rootObj, true)
    );
  }

  if (valueType === "number") {
    drafts.push(
      draft(path, "wrong-type-string", `${path} - String Instead`, "string", rootObj, "not-a-number"),
      draft(path, "overflow", `${path} - Large Number`, "large", rootObj, Number.MAX_SAFE_INTEGER)
    );
  }

  if (valueType === "boolean") {
    pushInvalidVariants(
      drafts,
      path,
      rootObj,
      [
        ["Number 0", 0],
        ["Number 1", 1],
        ["String true", "true"],
        ["String false", "false"],
        ["Empty Array", []],
        ["Empty Object", {}],
      ],
      "Invalid Boolean"
    );
  }

  if (key.toLowerCase().includes("password") || key.toLowerCase().includes("secret")) {
    drafts.push(draft(path, "empty-secret", `${path} - Empty Secret`, "empty", rootObj, ""));
  }
}

function pushArrayCases(
  drafts: BodyCaseDraft[],
  path: string,
  rootObj: Record<string, unknown>,
  value: unknown
) {
  drafts.push(
    draft(path, "empty-array", `${path} - Empty Array`, "[]", rootObj, []),
    draft(path, "null-array", `${path} - Null Array`, "null", rootObj, null),
    draft(path, "mixed-types", `${path} - Mixed Types`, "mixed", rootObj, [
      "string",
      123,
      true,
    ]),
    draft(
      path,
      "max-array",
      `${path} - Exceeds max items`,
      "101 items",
      rootObj,
      new Array(101).fill(Array.isArray(value) && value.length > 0 ? value[0] : null)
    )
  );
}

function pushObjectCases(
  drafts: BodyCaseDraft[],
  path: string,
  rootObj: Record<string, unknown>,
  value: Record<string, unknown>
) {
  drafts.push(
    draft(path, "empty-object", `${path} - Empty Object`, "{}", rootObj, {}),
    draft(path, "null-object", `${path} - Null Object`, "null", rootObj, null),
    draft(path, "unknown-field", `${path} - Unknown Field`, "extra", rootObj, {
      ...value,
      unknownField: "unexpected",
    }),
    draft(
      path,
      "all-null-fields",
      `${path} - All Null Fields`,
      "all null",
      rootObj,
      Object.fromEntries(Object.keys(value).map((k) => [k, null]))
    )
  );
}

function pushInvalidVariants(
  drafts: BodyCaseDraft[],
  path: string,
  rootObj: Record<string, unknown>,
  invalidValues: [string, unknown][],
  prefix: string
) {
  for (const [label, val] of invalidValues) {
    drafts.push(
      draft(
        path,
        `${prefix}-${label}`.replace(/\s+/g, "-").toLowerCase(),
        `${path} - ${prefix} (${label})`,
        String(val),
        rootObj,
        val
      )
    );
  }
}
