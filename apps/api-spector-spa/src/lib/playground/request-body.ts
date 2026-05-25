import { resolveOpenApiSchema } from "@/lib/openapi-schema";

export type RequestBodyKind = "none" | "json" | "multipart" | "binary";

export type MultipartFieldDef = {
  name: string;
  required: boolean;
  isFile: boolean;
  description?: string;
};

export type RequestBodyInfo = {
  kind: RequestBodyKind;
  contentType: string | null;
  multipartFields: MultipartFieldDef[];
};

type OpenApiComponents = { schemas?: Record<string, unknown> };

type ContentEntry = {
  schema?: unknown;
  example?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Prefer multipart/binary over JSON when multiple content types exist. */
export function pickRequestBodyContent(
  content?: Record<string, ContentEntry>
): { mediaType: string; entry: ContentEntry } | null {
  if (!content) return null;

  const priority = [
    "multipart/form-data",
    "application/octet-stream",
    "application/json",
    "application/*+json",
  ];

  for (const mediaType of priority) {
    if (content[mediaType]) {
      return { mediaType, entry: content[mediaType] };
    }
  }

  for (const [mediaType, entry] of Object.entries(content)) {
    if (entry) return { mediaType, entry };
  }

  return null;
}

function isBinaryProperty(prop: Record<string, unknown>): boolean {
  if (prop.format === "binary") return true;
  if (prop.type === "string" && prop.format === "byte") return true;
  return false;
}

function extractMultipartFields(
  schema: unknown,
  components: unknown
): MultipartFieldDef[] {
  const resolved = resolveOpenApiSchema(
    schema,
    components as OpenApiComponents | undefined
  );
  if (!isRecord(resolved)) return [];

  const props = (resolved.properties as Record<string, unknown>) ?? {};
  const required = new Set((resolved.required as string[]) ?? []);

  return Object.keys(props).map((name) => {
    const prop = props[name] as Record<string, unknown>;
    return {
      name,
      required: required.has(name),
      isFile: isBinaryProperty(prop),
      description:
        typeof prop.description === "string" ? prop.description : undefined,
    };
  });
}

export function getRequestBodyInfo(
  methodData: Record<string, unknown> | null,
  components: unknown
): RequestBodyInfo {
  const requestBody = methodData?.requestBody;
  if (!requestBody || !isRecord(requestBody)) {
    return { kind: "none", contentType: null, multipartFields: [] };
  }

  const content = requestBody.content as Record<string, ContentEntry> | undefined;
  const picked = pickRequestBodyContent(content);
  if (!picked) {
    return { kind: "none", contentType: null, multipartFields: [] };
  }

  const { mediaType } = picked;

  if (mediaType === "multipart/form-data" || mediaType.includes("multipart")) {
    const fields = extractMultipartFields(picked.entry.schema, components);
    return {
      kind: "multipart",
      contentType: mediaType,
      multipartFields: fields,
    };
  }

  if (mediaType === "application/octet-stream") {
    return {
      kind: "binary",
      contentType: mediaType,
      multipartFields: [],
    };
  }

  if (
    mediaType === "application/json" ||
    mediaType.includes("json") ||
    picked.entry.schema
  ) {
    return {
      kind: "json",
      contentType: mediaType,
      multipartFields: [],
    };
  }

  return {
    kind: "json",
    contentType: mediaType,
    multipartFields: [],
  };
}

/** Human-readable hint for Parameters tab sample body. */
export function formatMultipartBodyHint(fields: MultipartFieldDef[]): string {
  if (fields.length === 0) {
    return "(multipart/form-data — add fields in Request tab)";
  }
  const lines = fields.map((f) => {
    const req = f.required ? "required" : "optional";
    const type = f.isFile ? "file (binary)" : "text";
    return `${f.name}: ${type} (${req})`;
  });
  return lines.join("\n");
}
