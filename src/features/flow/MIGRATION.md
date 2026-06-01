# Test Flow schema migration guide

## Overview

Flows now support two representations:

| Format | Location | Use case |
|--------|----------|----------|
| **Legacy** (`Flow` / `FlowStep`) | SQLite, existing UI | Current persisted data |
| **Declarative** (`FlowDefinition` / `DeclarativeStep`) | Export, collections, future builder | Postman/OpenAPI-style documents |

Execution uses the **legacy** shape internally. Convert with adapters in `@/domain/flows/services/flow-adapter`.

## Variable tokens

| Token | Description |
|-------|-------------|
| `{{vars.name}}` | Captured variable (unchanged) |
| `{{global.name}}` | Flow/global scope |
| `{{env.name}}` | Environment variable |
| `{{baseUrl}}` | Shorthand for `env.baseUrl` |
| `{{steps.0.body.id}}` | Prior step by index (unchanged) |
| `{{step.Login.body.token}}` | Prior step by **name** |
| `{{random.uuid}}` | Built-in UUID |
| `{{random.int}}` | Random integer |
| `{{timestamp}}` | Unix ms |
| `{{timestamp.iso}}` | ISO-8601 string |

## Optional flow fields (backward compatible)

```typescript
flow.baseUrl = "https://api.example.com";
flow.variables = { tenantId: "demo" };
flow.environment = { name: "dev", baseUrl: "...", variables: { token: "..." } };
flow.executionMode = "sequential"; // "parallel" | "conditional"
```

### Execution modes

| Mode | Behavior |
|------|----------|
| `sequential` | Default. Steps run in order; captures chain via shared context. |
| `parallel` | All steps run concurrently (isolated context per step; no shared captures). Step-through disabled. |
| `conditional` | Sequential, but steps with `condition` are skipped when the resolved expression is falsy. |

## Optional step fields

```typescript
step.name = "Login";
step.delayMs = 500;
step.retry = { count: 2, delayMs: 1000 };
step.ui = { color: "#0ea5e9", group: "Auth" };
step.condition = "{{vars.token}}"; // conditional mode only
```

## Execution results

`StepRunResult` now includes Postman-style fields (legacy fields unchanged):

- `runStatus`: `"passed" | "failed" | "error" | "skipped"`
- `request` / `response`: structured snapshots
- `assertions`: per-rule results
- `errorMessage`: alias of `error`

## Collections

```typescript
import type { FlowCollection } from "@/features/flow/schema";

const suite: FlowCollection = {
  id: "smoke",
  name: "Smoke tests",
  flows: [/* FlowDefinition[] */],
};
```

## Validate before run

```typescript
import { validateLegacyFlowSchema, hasBlockingIssues } from "@/features/flow/schema";

const issues = validateLegacyFlowSchema(flow);
if (hasBlockingIssues(issues)) { /* show errors */ }
```

## Convert legacy → declarative

```typescript
import { legacyFlowToDefinition } from "@/features/flow/schema";

const doc = legacyFlowToDefinition(flow, baseUrl);
```
