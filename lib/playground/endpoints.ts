export type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    format?: string;
    enum?: string[];
    default?: unknown;
  };
};

export type PlaygroundEndpoint = {
  path: string;
  method: string;
  controller: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: OpenApiParameter[];
  hasRequestBody: boolean;
  requiresAuth: boolean;
};

export function requiresAuth(
  operationSecurity: unknown[] | undefined,
  globalSecurity: unknown[] | undefined
): boolean {
  if (operationSecurity !== undefined) return operationSecurity.length > 0;
  return (globalSecurity?.length ?? 0) > 0;
}

export function extractPlaygroundEndpoints(apiData: {
  paths?: Record<string, Record<string, unknown>>;
  security?: unknown[];
}): PlaygroundEndpoint[] {
  const endpoints: PlaygroundEndpoint[] = [];
  const globalSecurity = apiData.security;

  Object.entries(apiData.paths ?? {}).forEach(([path, methods]) => {
    Object.entries(methods as Record<string, Record<string, unknown>>).forEach(
      ([method, data]) => {
        if (
          !["get", "post", "put", "patch", "delete", "head", "options"].includes(
            method
          )
        ) {
          return;
        }
        const controller =
          Array.isArray(data.tags) && data.tags.length > 0
            ? String(data.tags[0])
            : "default";
        const parameters = (data.parameters as OpenApiParameter[]) ?? [];
        const hasRequestBody = Boolean(
          data.requestBody &&
            typeof data.requestBody === "object" &&
            Object.keys(data.requestBody as object).length > 0
        );
        const operationSecurity = data.security as unknown[] | undefined;

        endpoints.push({
          path,
          method: method.toUpperCase(),
          controller,
          operationId: data.operationId as string | undefined,
          summary: data.summary as string | undefined,
          description: data.description as string | undefined,
          parameters,
          hasRequestBody,
          requiresAuth: requiresAuth(operationSecurity, globalSecurity),
        });
      }
    );
  });

  return endpoints.sort((a, b) => {
    const tag = a.controller.localeCompare(b.controller);
    if (tag !== 0) return tag;
    return a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
  });
}

export function groupEndpointsByController(
  endpoints: PlaygroundEndpoint[]
): Record<string, PlaygroundEndpoint[]> {
  return endpoints.reduce<Record<string, PlaygroundEndpoint[]>>((acc, ep) => {
    if (!acc[ep.controller]) acc[ep.controller] = [];
    acc[ep.controller].push(ep);
    return acc;
  }, {});
}
