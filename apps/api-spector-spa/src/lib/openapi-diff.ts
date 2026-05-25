export type Severity = "breaking" | "non-breaking" | "additive";

export type EndpointRef = {
  path: string;
  method: string;
  tag?: string;
  severity: Severity;
};

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
  severity: Severity;
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
  severity: Severity;
};

export type SeverityCounts = {
  breaking: number;
  nonBreaking: number;
  additive: number;
};

export type DiffSummary = {
  added: EndpointRef[];
  removed: EndpointRef[];
  changed: EndpointChange[];
  moved: MovedEndpoint[];
  infoChanged: boolean;
  suggestedBump: "major" | "minor" | "patch";
  worstSeverity: Severity;
  severityCounts: SeverityCounts;
};

export type DiffKind = "added" | "removed" | "changed" | "moved";
export type SeverityFilter = Severity | "all";

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

const SEVERITY_RANK: Record<Severity, number> = {
  breaking: 3,
  "non-breaking": 2,
  additive: 1,
};

function maxSeverity(...levels: Severity[]): Severity {
  return levels.reduce((best, s) =>
    SEVERITY_RANK[s] > SEVERITY_RANK[best] ? s : best
  );
}

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

function paramKey(p: Record<string, unknown>): string {
  return `${String(p.in ?? "query")}:${String(p.name ?? "")}`;
}

function diffParams(
  oldParams: unknown,
  newParams: unknown
): FieldDelta<ParamDelta> | undefined {
  const oldList = Array.isArray(oldParams) ? oldParams : [];
  const newList = Array.isArray(newParams) ? newParams : [];

  const oldMap = new Map<string, Record<string, unknown>>();
  const newMap = new Map<string, Record<string, unknown>>();

  for (const p of oldList) {
    if (p && typeof p === "object")
      oldMap.set(paramKey(p as Record<string, unknown>), p as Record<string, unknown>);
  }
  for (const p of newList) {
    if (p && typeof p === "object")
      newMap.set(paramKey(p as Record<string, unknown>), p as Record<string, unknown>);
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

function schemaFromContent(
  rb: unknown,
  mediaType: string
): Record<string, unknown> | null {
  if (!rb || typeof rb !== "object") return null;
  const content = (rb as Record<string, unknown>).content as
    | Record<string, { schema?: unknown }>
    | undefined;
  const entry = content?.[mediaType];
  if (!entry?.schema || typeof entry.schema !== "object") return null;
  return entry.schema as Record<string, unknown>;
}

/** Compare JSON Schema shapes for breaking vs additive vs non-breaking changes. */
export function compareJsonSchemas(
  oldSchema: unknown,
  newSchema: unknown
): Severity {
  if (oldSchema == null && newSchema == null) return "non-breaking";
  if (oldSchema == null) return "additive";
  if (newSchema == null) return "breaking";

  const oldS =
    typeof oldSchema === "object"
      ? (oldSchema as Record<string, unknown>)
      : null;
  const newS =
    typeof newSchema === "object"
      ? (newSchema as Record<string, unknown>)
      : null;
  if (!oldS || !newS) {
    return stableStringify(oldSchema) === stableStringify(newSchema)
      ? "non-breaking"
      : "breaking";
  }

  if (stableStringify(oldS) === stableStringify(newS)) return "non-breaking";

  const oldType = normalizeSchemaType(oldS);
  const newType = normalizeSchemaType(newS);
  if (oldType && newType && oldType !== newType) return "breaking";

  const oldEnum = enumValues(oldS);
  const newEnum = enumValues(newS);
  if (oldEnum.length > 0 && newEnum.length > 0) {
    const newSet = new Set(newEnum.map(String));
    const allOldInNew = oldEnum.every((v) => newSet.has(String(v)));
    const allNewInOld = newEnum.every((v) => oldEnum.map(String).includes(String(v)));
    if (!allOldInNew) return "breaking";
    if (!allNewInOld && allOldInNew) return "additive";
    if (allNewInOld && allOldInNew) return "non-breaking";
  }

  const oldReq = requiredFields(oldS);
  const newReq = requiredFields(newS);
  for (const f of newReq) {
    if (!oldReq.includes(f)) return "breaking";
  }
  for (const f of oldReq) {
    if (!newReq.includes(f)) {
      /* optional in new — non-breaking at schema level */
    }
  }
  if (newReq.length < oldReq.length && oldReq.some((f) => !newReq.includes(f))) {
    /* at least one field became optional */
  }

  const oldProps = objectProperties(oldS);
  const newProps = objectProperties(newS);
  if (oldProps || newProps) {
    const oKeys = Object.keys(oldProps ?? {});
    const nKeys = Object.keys(newProps ?? {});
    for (const k of oKeys) {
      if (!nKeys.includes(k)) return "breaking";
    }
    let worst: Severity = "non-breaking";
    for (const k of nKeys) {
      if (!oKeys.includes(k)) {
        worst = maxSeverity(worst, "additive");
        continue;
      }
      worst = maxSeverity(
        worst,
        compareJsonSchemas(oldProps![k], newProps![k])
      );
    }
    return worst;
  }

  return "breaking";
}

function normalizeSchemaType(schema: Record<string, unknown>): string | null {
  if (typeof schema.type === "string") return schema.type;
  if (Array.isArray(schema.type)) {
    return [...schema.type].sort().join("|");
  }
  if (schema.oneOf || schema.anyOf) return "union";
  if (schema.allOf) return "allOf";
  return null;
}

function enumValues(schema: Record<string, unknown>): unknown[] {
  if (Array.isArray(schema.enum)) return schema.enum;
  return [];
}

function requiredFields(schema: Record<string, unknown>): string[] {
  if (!Array.isArray(schema.required)) return [];
  return schema.required.filter((x): x is string => typeof x === "string");
}

function objectProperties(
  schema: Record<string, unknown>
): Record<string, unknown> | null {
  const props = schema.properties;
  if (props && typeof props === "object") {
    return props as Record<string, unknown>;
  }
  return null;
}

function paramRequired(p: Record<string, unknown>): boolean {
  return p.required === true;
}

function paramHasDefault(p: Record<string, unknown>): boolean {
  const schema = p.schema;
  if (schema && typeof schema === "object") {
    return (schema as Record<string, unknown>).default !== undefined;
  }
  return false;
}

function classifyParams(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>,
  params: FieldDelta<ParamDelta>
): Severity {
  let worst: Severity = "non-breaking";

  if (params.removed.length > 0) return "breaking";

  const oldList = Array.isArray(oldOp.parameters) ? oldOp.parameters : [];
  const newList = Array.isArray(newOp.parameters) ? newOp.parameters : [];
  const oldMap = new Map<string, Record<string, unknown>>();
  const newMap = new Map<string, Record<string, unknown>>();
  for (const p of oldList) {
    if (p && typeof p === "object")
      oldMap.set(paramKey(p as Record<string, unknown>), p as Record<string, unknown>);
  }
  for (const p of newList) {
    if (p && typeof p === "object")
      newMap.set(paramKey(p as Record<string, unknown>), p as Record<string, unknown>);
  }

  for (const added of params.added) {
    const key = `${added.in}:${added.name}`;
    const newP = newMap.get(key);
    if (newP && paramRequired(newP) && !paramHasDefault(newP)) {
      worst = maxSeverity(worst, "breaking");
    } else {
      worst = maxSeverity(worst, "additive");
    }
  }

  for (const key of newMap.keys()) {
    const oldP = oldMap.get(key);
    const newP = newMap.get(key);
    if (!oldP || !newP) continue;
    const wasReq = paramRequired(oldP);
    const nowReq = paramRequired(newP);
    if (wasReq && !nowReq) {
      worst = maxSeverity(worst, "non-breaking");
    } else if (!wasReq && nowReq) {
      worst = maxSeverity(worst, "breaking");
    } else if (stableStringify(oldP) !== stableStringify(newP)) {
      const schemaOld = oldP.schema;
      const schemaNew = newP.schema;
      worst = maxSeverity(
        worst,
        compareJsonSchemas(schemaOld, schemaNew)
      );
    }
  }

  return worst;
}

function classifyRequestBody(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>,
  rb: NonNullable<EndpointChange["details"]["requestBody"]>
): Severity {
  let worst: Severity = "non-breaking";
  if (rb.removed.length > 0) return "breaking";
  if (rb.added.length > 0) worst = maxSeverity(worst, "additive");
  for (const mt of rb.changed) {
    const sev = compareJsonSchemas(
      schemaFromContent(oldOp.requestBody, mt),
      schemaFromContent(newOp.requestBody, mt)
    );
    worst = maxSeverity(worst, sev);
  }
  return worst;
}

function classifyResponses(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>,
  resp: NonNullable<EndpointChange["details"]["responses"]>
): Severity {
  let worst: Severity = "non-breaking";
  if (resp.removed.length > 0) return "breaking";
  if (resp.added.length > 0) worst = maxSeverity(worst, "additive");

  const oldObj =
    oldOp.responses && typeof oldOp.responses === "object"
      ? (oldOp.responses as Record<string, unknown>)
      : {};
  const newObj =
    newOp.responses && typeof newOp.responses === "object"
      ? (newOp.responses as Record<string, unknown>)
      : {};

  for (const code of resp.changed) {
    const oldR = oldObj[code];
    const newR = newObj[code];
    const is2xx = code.startsWith("2");
    const oldContent =
      oldR && typeof oldR === "object"
        ? ((oldR as Record<string, unknown>).content as Record<string, unknown> | undefined)
        : undefined;
    const newContent =
      newR && typeof newR === "object"
        ? ((newR as Record<string, unknown>).content as Record<string, unknown> | undefined)
        : undefined;
    const mediaTypes = new Set([
      ...Object.keys(oldContent ?? {}),
      ...Object.keys(newContent ?? {}),
    ]);
    for (const mt of mediaTypes) {
      const sev = compareJsonSchemas(
        oldContent?.[mt] &&
          typeof oldContent[mt] === "object" &&
          (oldContent[mt] as { schema?: unknown }).schema,
        newContent?.[mt] &&
          typeof newContent[mt] === "object" &&
          (newContent[mt] as { schema?: unknown }).schema
      );
      if (is2xx) {
        worst = maxSeverity(worst, sev === "additive" ? "non-breaking" : sev);
      } else {
        worst = maxSeverity(worst, sev);
      }
    }
    if (mediaTypes.size === 0 && stableStringify(oldR) !== stableStringify(newR)) {
      worst = maxSeverity(worst, "breaking");
    }
  }
  return worst;
}

export function classifyChange(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>,
  reasons: ChangeReason[],
  details: EndpointChange["details"]
): Severity {
  const severities: Severity[] = [];

  if (details.params) {
    severities.push(classifyParams(oldOp, newOp, details.params));
  }
  if (details.requestBody) {
    severities.push(classifyRequestBody(oldOp, newOp, details.requestBody));
  }
  if (details.responses) {
    severities.push(classifyResponses(oldOp, newOp, details.responses));
  }
  if (details.operationId) severities.push("non-breaking");
  if (details.tags) severities.push("non-breaking");
  if (details.summary) severities.push("non-breaking");

  if (severities.length === 0) {
    return reasons.length > 0 ? "non-breaking" : "non-breaking";
  }
  return maxSeverity(...severities);
}

function buildChangeDetails(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>
): {
  reasons: ChangeReason[];
  details: EndpointChange["details"];
  severity: Severity;
} {
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

  const severity = classifyChange(oldOp, newOp, reasons, details);
  return { reasons, details, severity };
}

function detectMoved(
  added: EndpointRef[],
  removed: EndpointRef[]
): {
  moved: MovedEndpoint[];
  addedOut: EndpointRef[];
  removedOut: EndpointRef[];
} {
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
          severity: "breaking",
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

function computeSeverityCounts(summary: Omit<DiffSummary, "worstSeverity" | "severityCounts">): {
  worstSeverity: Severity;
  severityCounts: SeverityCounts;
} {
  const severityCounts: SeverityCounts = {
    breaking: 0,
    nonBreaking: 0,
    additive: 0,
  };

  const bump = (s: Severity) => {
    if (s === "breaking") severityCounts.breaking++;
    else if (s === "additive") severityCounts.additive++;
    else severityCounts.nonBreaking++;
  };

  for (const e of summary.added) bump(e.severity);
  for (const e of summary.removed) bump(e.severity);
  for (const e of summary.changed) bump(e.severity);
  for (const e of summary.moved) bump(e.severity);

  let worstSeverity: Severity = "additive";
  if (severityCounts.breaking > 0) worstSeverity = "breaking";
  else if (severityCounts.nonBreaking > 0) worstSeverity = "non-breaking";

  return { worstSeverity, severityCounts };
}

function inferChangedSeverity(
  reasons: ChangeReason[],
  details: EndpointChange["details"]
): Severity {
  if (details.params?.removed.length) return "breaking";
  if (details.responses?.removed.length) return "breaking";
  if (details.requestBody?.removed.length) return "breaking";
  if (
    reasons.includes("requestBody") ||
    reasons.includes("responses")
  ) {
    return "breaking";
  }
  if (reasons.every((r) => r === "operationId" || r === "tags" || r === "summary")) {
    return "non-breaking";
  }
  return "non-breaking";
}

function backfillSummarySeverity(summary: DiffSummary): DiffSummary {
  const added = summary.added.map((e) => ({
    ...e,
    severity: e.severity ?? "additive",
  }));
  const removed = summary.removed.map((e) => ({
    ...e,
    severity: e.severity ?? "breaking",
  }));
  const changed = summary.changed.map((c) => ({
    ...c,
    severity: c.severity ?? inferChangedSeverity(c.reasons, c.details),
  }));
  const moved = summary.moved.map((m) => ({
    ...m,
    severity: m.severity ?? "breaking",
  }));

  const base = { ...summary, added, removed, changed, moved };
  const { worstSeverity, severityCounts } = computeSeverityCounts(base);

  let suggestedBump = summary.suggestedBump;
  if (worstSeverity === "breaking") {
    suggestedBump = "major";
  }

  return {
    ...base,
    worstSeverity,
    severityCounts,
    suggestedBump,
  };
}

export function diffOpenApi(oldDoc: OpenApiDoc, newDoc: OpenApiDoc): DiffSummary {
  const oldEndpoints = collectEndpoints(oldDoc);
  const newEndpoints = collectEndpoints(newDoc);

  let added: EndpointRef[] = [];
  let removed: EndpointRef[] = [];
  const changed: EndpointChange[] = [];

  for (const [key, newOp] of newEndpoints) {
    const oldOp = oldEndpoints.get(key);
    if (!oldOp) {
      const { method, path } = parseKey(key);
      added.push({
        method,
        path,
        tag: firstTag(newOp),
        severity: "additive",
      });
      continue;
    }
    const { reasons, details, severity } = buildChangeDetails(oldOp, newOp);
    if (reasons.length > 0) {
      const { method, path } = parseKey(key);
      changed.push({
        method,
        path,
        tag: firstTag(newOp) ?? firstTag(oldOp),
        reasons,
        details,
        severity,
      });
    }
  }

  for (const key of oldEndpoints.keys()) {
    if (!newEndpoints.has(key)) {
      const { method, path } = parseKey(key);
      const oldOp = oldEndpoints.get(key)!;
      removed.push({
        method,
        path,
        tag: firstTag(oldOp),
        severity: "breaking",
      });
    }
  }

  const { moved, addedOut, removedOut } = detectMoved(added, removed);
  added = addedOut;
  removed = removedOut;

  const infoChanged =
    stableStringify(oldDoc.info) !== stableStringify(newDoc.info);

  const partial = {
    added,
    removed,
    changed,
    moved,
    infoChanged,
    suggestedBump: "patch" as const,
  };

  const { worstSeverity, severityCounts } = computeSeverityCounts(partial);

  let suggestedBump: DiffSummary["suggestedBump"] = "patch";
  if (worstSeverity === "breaking") {
    suggestedBump = "major";
  } else if (added.length > 0 || moved.length > 0) {
    suggestedBump = "minor";
  } else if (changed.length > 0 || infoChanged) {
    suggestedBump = "patch";
  }

  return {
    ...partial,
    suggestedBump,
    worstSeverity,
    severityCounts,
  };
}

/** Normalize legacy summaries stored before moved/details/severity existed. */
export function normalizeDiffSummary(raw: unknown): DiffSummary {
  if (!raw || typeof raw !== "object") {
    return emptyDiffSummary();
  }
  const s = raw as Record<string, unknown>;
  const changedRaw = Array.isArray(s.changed) ? s.changed : [];
  const changed: EndpointChange[] = changedRaw.map((c) => {
    const item = c as Record<string, unknown>;
    const reasons = Array.isArray(item.reasons)
      ? (item.reasons as ChangeReason[])
      : [];
    const details =
      item.details && typeof item.details === "object"
        ? (item.details as EndpointChange["details"])
        : {};
    return {
      path: String(item.path ?? ""),
      method: String(item.method ?? ""),
      tag: item.tag != null ? String(item.tag) : undefined,
      reasons,
      details,
      severity:
        item.severity === "breaking" ||
        item.severity === "non-breaking" ||
        item.severity === "additive"
          ? (item.severity as Severity)
          : inferChangedSeverity(reasons, details),
    };
  });

  const mapRef = (item: unknown, defaultSeverity: Severity): EndpointRef => {
    const r = item as Record<string, unknown>;
    const sev = r.severity;
    return {
      path: String(r.path ?? ""),
      method: String(r.method ?? ""),
      tag: r.tag != null ? String(r.tag) : undefined,
      severity:
        sev === "breaking" || sev === "non-breaking" || sev === "additive"
          ? (sev as Severity)
          : defaultSeverity,
    };
  };

  const summary: DiffSummary = {
    added: Array.isArray(s.added)
      ? (s.added as unknown[]).map((x) => mapRef(x, "additive"))
      : [],
    removed: Array.isArray(s.removed)
      ? (s.removed as unknown[]).map((x) => mapRef(x, "breaking"))
      : [],
    changed,
    moved: Array.isArray(s.moved)
      ? (s.moved as unknown[]).map((m) => {
          const item = m as Record<string, unknown>;
          return {
            method: String(item.method ?? ""),
            from: String(item.from ?? ""),
            to: String(item.to ?? ""),
            tag: item.tag != null ? String(item.tag) : undefined,
            reason: "versionedPath" as const,
            severity:
              item.severity === "breaking" ||
              item.severity === "non-breaking" ||
              item.severity === "additive"
                ? (item.severity as Severity)
                : "breaking",
          };
        })
      : [],
    infoChanged: Boolean(s.infoChanged),
    suggestedBump:
      s.suggestedBump === "major" ||
      s.suggestedBump === "minor" ||
      s.suggestedBump === "patch"
        ? s.suggestedBump
        : "patch",
    worstSeverity: "additive",
    severityCounts: { breaking: 0, nonBreaking: 0, additive: 0 },
  };

  return backfillSummarySeverity(summary);
}

function emptyDiffSummary(): DiffSummary {
  return {
    added: [],
    removed: [],
    changed: [],
    moved: [],
    infoChanged: false,
    suggestedBump: "patch",
    worstSeverity: "additive",
    severityCounts: { breaking: 0, nonBreaking: 0, additive: 0 },
  };
}

export function formatSeverityCounts(summary: DiffSummary): string {
  const parts: string[] = [];
  const { severityCounts: c } = summary;
  if (c.breaking) parts.push(`${c.breaking} breaking`);
  if (c.nonBreaking) parts.push(`${c.nonBreaking} non-breaking`);
  if (c.additive) parts.push(`${c.additive} additive`);
  return parts.length ? parts.join(" · ") : "";
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
