export type EndpointRef = { path: string; method: string; tag?: string };

export type ChangeReason =
  | "params"
  | "requestBody"
  | "responses"
  | "operationId"
  | "tags"
  | "summary";

export type FieldDelta<T> = { added: T[]; removed: T[]; changed: T[] };

export type ParamDelta = { name: string; in: string };

export type EndpointChange = {
  path: string;
  method: string;
  tag?: string;
  reasons: ChangeReason[];
  details: {
    params?: FieldDelta<ParamDelta>;
    requestBody?: { added: string[]; removed: string[]; changed: string[] };
    responses?: FieldDelta<string>;
    operationId?: { from?: string; to?: string };
    tags?: { added: string[]; removed: string[] };
    summary?: { from?: string; to?: string };
  };
};

export type MovedEndpoint = {
  method: string;
  from: string;
  to: string;
  tag?: string;
  reason: "versionedPath";
};

export type DiffSummary = {
  added: EndpointRef[];
  removed: EndpointRef[];
  changed: EndpointChange[];
  moved: MovedEndpoint[];
  infoChanged: boolean;
  suggestedBump: "major" | "minor" | "patch";
};

export type DiffKind = "added" | "removed" | "changed" | "moved";

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

const VERSION_SEGMENT = /\/v\d+(?:\.\d+)?(?=\/|$)/i;

function stableStringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function firstTag(op: Record<string, unknown>): string | undefined {
  const tags = op.tags;
  if (Array.isArray(tags) && tags.length > 0 && typeof tags[0] === "string") {
    return tags[0];
  }
  return undefined;
}

export function stripPathVersion(path: string): {
  base: string;
  version: string | null;
} {
  const match = path.match(VERSION_SEGMENT);
  if (!match) return { base: path, version: null };
  const version = match[0].slice(1);
  const base = path.replace(VERSION_SEGMENT, "");
  return { base: base || "/", version };
}

function parseKey(key: string): { method: string; path: string } {
  const space = key.indexOf(" ");
  return {
    method: key.slice(0, space),
    path: key.slice(space + 1),
  };
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

function diffStringArray(oldArr: string[], newArr: string[]): FieldDelta<string> {
  const oldSet = new Set(oldArr);
  const newSet = new Set(newArr);
  const added = newArr.filter((x) => !oldSet.has(x));
  const removed = oldArr.filter((x) => !newSet.has(x));
  const changed: string[] = [];
  return { added, removed, changed };
}

function diffParams(
  oldParams: unknown,
  newParams: unknown
): FieldDelta<ParamDelta> | undefined {
  const oldList = Array.isArray(oldParams) ? oldParams : [];
  const newList = Array.isArray(newParams) ? newParams : [];

  const keyOf = (p: Record<string, unknown>) =>
    `${String(p.in ?? "query")}:${String(p.name ?? "")}`;

  const oldMap = new Map<string, Record<string, unknown>>();
  const newMap = new Map<string, Record<string, unknown>>();

  for (const p of oldList) {
    if (p && typeof p === "object") oldMap.set(keyOf(p as Record<string, unknown>), p as Record<string, unknown>);
  }
  for (const p of newList) {
    if (p && typeof p === "object") newMap.set(keyOf(p as Record<string, unknown>), p as Record<string, unknown>);
  }

  const added: ParamDelta[] = [];
  const removed: ParamDelta[] = [];
  const changed: ParamDelta[] = [];

  for (const [key, newP] of newMap) {
    const oldP = oldMap.get(key);
    if (!oldP) {
      added.push({
        name: String(newP.name ?? ""),
        in: String(newP.in ?? "query"),
      });
    } else if (stableStringify(oldP) !== stableStringify(newP)) {
      changed.push({
        name: String(newP.name ?? ""),
        in: String(newP.in ?? "query"),
      });
    }
  }

  for (const [key, oldP] of oldMap) {
    if (!newMap.has(key)) {
      removed.push({
        name: String(oldP.name ?? ""),
        in: String(oldP.in ?? "query"),
      });
    }
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return undefined;
  }
  return { added, removed, changed };
}

function diffMediaTypes(
  oldRB: unknown,
  newRB: unknown
): { added: string[]; removed: string[]; changed: string[] } | undefined {
  const oldContent =
    oldRB && typeof oldRB === "object"
      ? ((oldRB as Record<string, unknown>).content as Record<string, unknown> | undefined)
      : undefined;
  const newContent =
    newRB && typeof newRB === "object"
      ? ((newRB as Record<string, unknown>).content as Record<string, unknown> | undefined)
      : undefined;

  const oldKeys = oldContent ? Object.keys(oldContent) : [];
  const newKeys = newContent ? Object.keys(newContent) : [];

  const delta = diffStringArray(oldKeys, newKeys);
  const changed: string[] = [];
  for (const key of newKeys) {
    if (oldKeys.includes(key) && oldContent && newContent) {
      if (stableStringify(oldContent[key]) !== stableStringify(newContent[key])) {
        changed.push(key);
      }
    }
  }

  if (
    delta.added.length === 0 &&
    delta.removed.length === 0 &&
    changed.length === 0
  ) {
    return undefined;
  }
  return { added: delta.added, removed: delta.removed, changed };
}

function diffResponses(
  oldResp: unknown,
  newResp: unknown
): FieldDelta<string> | undefined {
  const oldObj =
    oldResp && typeof oldResp === "object"
      ? (oldResp as Record<string, unknown>)
      : {};
  const newObj =
    newResp && typeof newResp === "object"
      ? (newResp as Record<string, unknown>)
      : {};

  const oldCodes = Object.keys(oldObj);
  const newCodes = Object.keys(newObj);
  const codeDelta = diffStringArray(oldCodes, newCodes);

  const changed: string[] = [];
  for (const code of newCodes) {
    if (oldCodes.includes(code)) {
      if (stableStringify(oldObj[code]) !== stableStringify(newObj[code])) {
        changed.push(code);
      }
    }
  }

  if (
    codeDelta.added.length === 0 &&
    codeDelta.removed.length === 0 &&
    changed.length === 0
  ) {
    return undefined;
  }
  return {
    added: codeDelta.added,
    removed: codeDelta.removed,
    changed,
  };
}

function buildChangeDetails(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>
): { reasons: ChangeReason[]; details: EndpointChange["details"] } {
  const reasons: ChangeReason[] = [];
  const details: EndpointChange["details"] = {};

  const params = diffParams(oldOp.parameters, newOp.parameters);
  if (params) {
    reasons.push("params");
    details.params = params;
  }

  const requestBody = diffMediaTypes(oldOp.requestBody, newOp.requestBody);
  if (requestBody) {
    reasons.push("requestBody");
    details.requestBody = requestBody;
  }

  const responses = diffResponses(oldOp.responses, newOp.responses);
  if (responses) {
    reasons.push("responses");
    details.responses = responses;
  }

  if (oldOp.operationId !== newOp.operationId) {
    reasons.push("operationId");
    details.operationId = {
      from: oldOp.operationId != null ? String(oldOp.operationId) : undefined,
      to: newOp.operationId != null ? String(newOp.operationId) : undefined,
    };
  }

  const oldTags = Array.isArray(oldOp.tags)
    ? (oldOp.tags as string[]).filter((t) => typeof t === "string")
    : [];
  const newTags = Array.isArray(newOp.tags)
    ? (newOp.tags as string[]).filter((t) => typeof t === "string")
    : [];
  const tagDelta = diffStringArray(oldTags, newTags);
  if (
    tagDelta.added.length > 0 ||
    tagDelta.removed.length > 0 ||
    tagDelta.changed.length > 0
  ) {
    reasons.push("tags");
    details.tags = { added: tagDelta.added, removed: tagDelta.removed };
  }

  const oldSummary =
    typeof oldOp.summary === "string" ? oldOp.summary : undefined;
  const newSummary =
    typeof newOp.summary === "string" ? newOp.summary : undefined;
  if (oldSummary !== newSummary) {
    reasons.push("summary");
    details.summary = { from: oldSummary, to: newSummary };
  }

  return { reasons, details };
}

function detectMoved(
  added: EndpointRef[],
  removed: EndpointRef[]
): { moved: MovedEndpoint[]; addedOut: EndpointRef[]; removedOut: EndpointRef[] } {
  const moved: MovedEndpoint[] = [];
  const usedAdded = new Set<number>();
  const usedRemoved = new Set<number>();

  for (let ri = 0; ri < removed.length; ri++) {
    const r = removed[ri];
    const rStrip = stripPathVersion(r.path);
    if (!rStrip.version) continue;

    for (let ai = 0; ai < added.length; ai++) {
      if (usedAdded.has(ai) || usedRemoved.has(ri)) continue;
      const a = added[ai];
      if (a.method !== r.method) continue;
      const aStrip = stripPathVersion(a.path);
      if (aStrip.base === rStrip.base && aStrip.version !== rStrip.version) {
        moved.push({
          method: r.method,
          from: r.path,
          to: a.path,
          tag: a.tag ?? r.tag,
          reason: "versionedPath",
        });
        usedAdded.add(ai);
        usedRemoved.add(ri);
        break;
      }
    }
  }

  return {
    moved,
    addedOut: added.filter((_, i) => !usedAdded.has(i)),
    removedOut: removed.filter((_, i) => !usedRemoved.has(i)),
  };
}

export function diffOpenApi(
  oldDoc: OpenApiDoc,
  newDoc: OpenApiDoc
): DiffSummary {
  const oldEndpoints = collectEndpoints(oldDoc);
  const newEndpoints = collectEndpoints(newDoc);

  let added: EndpointRef[] = [];
  let removed: EndpointRef[] = [];
  const changed: EndpointChange[] = [];

  for (const [key, newOp] of newEndpoints) {
    const oldOp = oldEndpoints.get(key);
    if (!oldOp) {
      const { method, path } = parseKey(key);
      added.push({ method, path, tag: firstTag(newOp) });
      continue;
    }
    const { reasons, details } = buildChangeDetails(oldOp, newOp);
    if (reasons.length > 0) {
      const { method, path } = parseKey(key);
      changed.push({
        method,
        path,
        tag: firstTag(newOp) ?? firstTag(oldOp),
        reasons,
        details,
      });
    }
  }

  for (const key of oldEndpoints.keys()) {
    if (!newEndpoints.has(key)) {
      const { method, path } = parseKey(key);
      const oldOp = oldEndpoints.get(key)!;
      removed.push({ method, path, tag: firstTag(oldOp) });
    }
  }

  const { moved, addedOut, removedOut } = detectMoved(added, removed);
  added = addedOut;
  removed = removedOut;

  const infoChanged =
    stableStringify(oldDoc.info) !== stableStringify(newDoc.info);

  let suggestedBump: DiffSummary["suggestedBump"] = "patch";

  const hasMajor =
    removed.length > 0 ||
    changed.some((c) =>
      c.reasons.some((r) => r === "requestBody" || r === "responses")
    );

  const hasMinor =
    added.length > 0 || moved.length > 0;

  if (hasMajor) {
    suggestedBump = "major";
  } else if (hasMinor) {
    suggestedBump = "minor";
  } else if (changed.length > 0 || infoChanged) {
    suggestedBump = "patch";
  }

  return {
    added,
    removed,
    changed,
    moved,
    infoChanged,
    suggestedBump,
  };
}

/** Normalize legacy summaries stored before moved/details existed. */
export function normalizeDiffSummary(raw: unknown): DiffSummary {
  if (!raw || typeof raw !== "object") {
    return emptyDiffSummary();
  }
  const s = raw as Record<string, unknown>;
  const changedRaw = Array.isArray(s.changed) ? s.changed : [];
  const changed: EndpointChange[] = changedRaw.map((c) => {
    const item = c as Record<string, unknown>;
    return {
      path: String(item.path ?? ""),
      method: String(item.method ?? ""),
      tag: item.tag != null ? String(item.tag) : undefined,
      reasons: Array.isArray(item.reasons)
        ? (item.reasons as ChangeReason[])
        : [],
      details:
        item.details && typeof item.details === "object"
          ? (item.details as EndpointChange["details"])
          : {},
    };
  });

  return {
    added: Array.isArray(s.added) ? (s.added as EndpointRef[]) : [],
    removed: Array.isArray(s.removed) ? (s.removed as EndpointRef[]) : [],
    changed,
    moved: Array.isArray(s.moved) ? (s.moved as MovedEndpoint[]) : [],
    infoChanged: Boolean(s.infoChanged),
    suggestedBump:
      s.suggestedBump === "major" ||
      s.suggestedBump === "minor" ||
      s.suggestedBump === "patch"
        ? s.suggestedBump
        : "patch",
  };
}

function emptyDiffSummary(): DiffSummary {
  return {
    added: [],
    removed: [],
    changed: [],
    moved: [],
    infoChanged: false,
    suggestedBump: "patch",
  };
}

export function parseVersion(version?: string): [number, number, number] {
  if (!version || version === "unknown") return [0, 0, 0];
  const parts = version
    .replace(/^v/i, "")
    .split(".")
    .map((p) => parseInt(p, 10) || 0);
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
    summary.moved.length === 0 &&
    !summary.infoChanged
  );
}

export function formatDiffCounts(summary: DiffSummary): string {
  const parts: string[] = [];
  if (summary.added.length) parts.push(`+${summary.added.length}`);
  if (summary.removed.length) parts.push(`-${summary.removed.length}`);
  if (summary.changed.length) parts.push(`~${summary.changed.length}`);
  if (summary.moved?.length) parts.push(`>${summary.moved.length}`);
  return parts.length ? parts.join(" / ") : "No changes";
}

export function totalDiffCount(summary: DiffSummary): number {
  return (
    summary.added.length +
    summary.removed.length +
    summary.changed.length +
    (summary.moved?.length ?? 0)
  );
}
