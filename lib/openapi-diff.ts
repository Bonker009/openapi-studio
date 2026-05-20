export type EndpointRef = { path: string; method: string };

export type ChangeReason =
  | "params"
  | "requestBody"
  | "responses"
  | "operationId"
  | "tags";

export type DiffSummary = {
  added: EndpointRef[];
  removed: EndpointRef[];
  changed: {
    path: string;
    method: string;
    reasons: ChangeReason[];
  }[];
  infoChanged: boolean;
  suggestedBump: "major" | "minor" | "patch";
};

type OpenApiDoc = {
  info?: Record<string, unknown>;
  paths?: Record<string, Record<string, unknown>>;
};

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const;

function stableStringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function collectEndpoints(doc: OpenApiDoc): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!doc.paths) return map;

  for (const [pathKey, pathItem] of Object.entries(doc.paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (op && typeof op === "object") {
        map.set(`${method.toUpperCase()} ${pathKey}`, op as Record<string, unknown>);
      }
    }
  }
  return map;
}

function getChangeReasons(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>
): ChangeReason[] {
  const reasons: ChangeReason[] = [];
  if (stableStringify(oldOp.parameters) !== stableStringify(newOp.parameters)) {
    reasons.push("params");
  }
  if (stableStringify(oldOp.requestBody) !== stableStringify(newOp.requestBody)) {
    reasons.push("requestBody");
  }
  if (stableStringify(oldOp.responses) !== stableStringify(newOp.responses)) {
    reasons.push("responses");
  }
  if (oldOp.operationId !== newOp.operationId) {
    reasons.push("operationId");
  }
  if (stableStringify(oldOp.tags) !== stableStringify(newOp.tags)) {
    reasons.push("tags");
  }
  return reasons;
}

export function diffOpenApi(
  oldDoc: OpenApiDoc,
  newDoc: OpenApiDoc
): DiffSummary {
  const oldEndpoints = collectEndpoints(oldDoc);
  const newEndpoints = collectEndpoints(newDoc);

  const added: EndpointRef[] = [];
  const removed: EndpointRef[] = [];
  const changed: DiffSummary["changed"] = [];

  for (const [key, newOp] of newEndpoints) {
    const oldOp = oldEndpoints.get(key);
    if (!oldOp) {
      const [method, ...pathParts] = key.split(" ");
      added.push({ method, path: pathParts.join(" ") });
      continue;
    }
    const reasons = getChangeReasons(oldOp, newOp);
    if (reasons.length > 0) {
      const [method, ...pathParts] = key.split(" ");
      changed.push({ method, path: pathParts.join(" "), reasons });
    }
  }

  for (const key of oldEndpoints.keys()) {
    if (!newEndpoints.has(key)) {
      const [method, ...pathParts] = key.split(" ");
      removed.push({ method, path: pathParts.join(" ") });
    }
  }

  const infoChanged =
    stableStringify(oldDoc.info) !== stableStringify(newDoc.info);

  let suggestedBump: DiffSummary["suggestedBump"] = "patch";

  const hasMajor =
    removed.length > 0 ||
    changed.some((c) =>
      c.reasons.some((r) => r === "requestBody" || r === "responses")
    );

  const hasMinor = added.length > 0;

  if (hasMajor) {
    suggestedBump = "major";
  } else if (hasMinor) {
    suggestedBump = "minor";
  } else if (
    changed.length > 0 ||
    infoChanged
  ) {
    suggestedBump = "patch";
  }

  return {
    added,
    removed,
    changed,
    infoChanged,
    suggestedBump,
  };
}

export function parseVersion(version?: string): [number, number, number] {
  if (!version || version === "unknown") return [0, 0, 0];
  const parts = version.replace(/^v/i, "").split(".").map((p) => parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function bumpVersion(
  current: string | undefined,
  bump: "major" | "minor" | "patch"
): string {
  const [major, minor, patch] = parseVersion(current);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function diffIsEmpty(summary: DiffSummary): boolean {
  return (
    summary.added.length === 0 &&
    summary.removed.length === 0 &&
    summary.changed.length === 0 &&
    !summary.infoChanged
  );
}

export function formatDiffCounts(summary: DiffSummary): string {
  const parts: string[] = [];
  if (summary.added.length) parts.push(`+${summary.added.length}`);
  if (summary.removed.length) parts.push(`-${summary.removed.length}`);
  if (summary.changed.length) parts.push(`~${summary.changed.length}`);
  return parts.length ? parts.join(" / ") : "No changes";
}
