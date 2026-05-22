"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Play,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Lock,
  RotateCcw,
  AlignLeft,
} from "lucide-react";
import { MethodBadge } from "@/components/method-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JsonBodyEditor } from "@/components/playground/json-body-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OperationSamples } from "@/components/playground/operation-samples";
import { ResponseViewer } from "@/components/playground/response-viewer";
import { executePlaygroundRequest } from "@/lib/playground/execute-request";
import { assertPlaygroundRequestUrl } from "@/lib/playground/url-policy";
import {
  buildRequestUrl,
  defaultParamValues,
  rebuildRequestUrlPreservingOrigin,
} from "@/lib/playground/build-request";
import { buildCurlCommand } from "@/lib/playground/build-curl";
import {
  formatJsonBody,
  formatResponseBodyForDisplay,
} from "@/lib/playground/json-format";
import type { OpenApiParameter, PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { getRequestBodySchema, schemaTypeLabel } from "@/lib/openapi-schema";
import {
  generateOpenApiSample,
  getOperationSamples,
} from "@/lib/playground/generate-sample";
import { toast } from "sonner";

type TryItPanelProps = {
  endpoint: PlaygroundEndpoint | null;
  apiData: { paths?: Record<string, unknown>; components?: unknown };
  baseUrl: string;
  activeTokenName: string | null;
  activeTokenValue: string | null;
  totalEndpoints?: number;
  onSelectFirst?: () => void;
};

function defaultPlaceholder(p: OpenApiParameter): string {
  if (p.schema?.default != null) return String(p.schema.default);
  if (p.schema?.enum?.[0]) return String(p.schema.enum[0]);
  return p.schema?.type ?? "string";
}

export function TryItPanel({
  endpoint,
  apiData,
  baseUrl,
  activeTokenName,
  activeTokenValue,
  totalEndpoints = 0,
  onSelectFirst,
}: TryItPanelProps) {
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState("");
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [requestUrl, setRequestUrl] = useState("");
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("params");
  const skipOriginPreserveRef = useRef(false);

  const methodData = useMemo(() => {
    if (!endpoint || !apiData.paths) return null;
    const methods = apiData.paths[endpoint.path] as
      | Record<string, unknown>
      | undefined;
    return methods?.[endpoint.method.toLowerCase()] as Record<string, unknown> | null;
  }, [endpoint, apiData]);

  const pathParams = useMemo(
    () => endpoint?.parameters.filter((p) => p.in === "path") ?? [],
    [endpoint]
  );
  const queryParams = useMemo(
    () => endpoint?.parameters.filter((p) => p.in === "query") ?? [],
    [endpoint]
  );
  const headerParams = useMemo(
    () => endpoint?.parameters.filter((p) => p.in === "header") ?? [],
    [endpoint]
  );

  const resetSampleBody = useCallback(() => {
    if (!methodData || !endpoint?.hasRequestBody) {
      setRequestBody("");
      return;
    }
    const samples = getOperationSamples(
      baseUrl,
      endpoint.path,
      methodData,
      endpoint.parameters,
      apiData.components
    );
    if (samples?.requestBody) {
      setRequestBody(samples.requestBody);
      return;
    }
    const schema = getRequestBodySchema(
      methodData as {
        requestBody?: { content?: Record<string, { schema?: unknown }> };
      }
    );
    if (schema) {
      const sample = generateOpenApiSample(schema, apiData.components);
      setRequestBody(JSON.stringify(sample ?? {}, null, 2));
    } else {
      setRequestBody("{}");
    }
  }, [methodData, endpoint, baseUrl, apiData.components]);

  useEffect(() => {
    if (!endpoint) return;
    setParamValues(defaultParamValues(endpoint.parameters));
    setHeaderValues(defaultParamValues(headerParams));
    setResponseStatus(null);
    setResponseTime(null);
    setResponseBody("");
    setResponseHeaders({});
    resetSampleBody();
    setActiveTab("params");
  }, [endpoint, methodData, headerParams, resetSampleBody]);

  const syncRequestUrlFromParams = useCallback(() => {
    if (!endpoint) return;
    setRequestUrl(
      buildRequestUrl(baseUrl, endpoint.path, paramValues, endpoint.parameters)
    );
  }, [baseUrl, endpoint, paramValues]);

  // Environment or endpoint change → always use the selected server base URL.
  useEffect(() => {
    if (!endpoint) {
      setRequestUrl("");
      skipOriginPreserveRef.current = true;
      return;
    }
    setRequestUrl(
      buildRequestUrl(baseUrl, endpoint.path, paramValues, endpoint.parameters)
    );
    skipOriginPreserveRef.current = true;
  }, [baseUrl, endpoint?.path, endpoint?.method]);

  // Query/path param edits only → keep a manually typed host (e.g. localhost:9090).
  useEffect(() => {
    if (!endpoint) return;
    if (skipOriginPreserveRef.current) {
      skipOriginPreserveRef.current = false;
      return;
    }
    setRequestUrl((prev) =>
      rebuildRequestUrlPreservingOrigin(
        prev,
        baseUrl,
        endpoint.path,
        paramValues,
        endpoint.parameters
      )
    );
  }, [paramValues, baseUrl, endpoint]);

  const buildHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (endpoint?.hasRequestBody && requestBody.trim()) {
      headers["Content-Type"] = "application/json";
    }
    headerParams.forEach((p) => {
      const v = headerValues[p.name]?.trim();
      if (v) headers[p.name] = v;
    });
    if (activeTokenValue) {
      headers.Authorization = `Bearer ${activeTokenValue}`;
    }
    return headers;
  }, [endpoint, requestBody, headerParams, headerValues, activeTokenValue]);

  const curlCommand = useMemo(() => {
    if (!endpoint) return "";
    return buildCurlCommand(
      requestUrl,
      endpoint.method,
      buildHeaders(),
      requestBody
    );
  }, [endpoint, requestUrl, buildHeaders, requestBody]);

  const execute = async () => {
    if (!endpoint) return;

    const urlCheck = assertPlaygroundRequestUrl(requestUrl, baseUrl);
    if (!urlCheck.ok) {
      toast.error(urlCheck.error);
      return;
    }

    setLoading(true);
    setResponseBody("");
    setResponseStatus(null);
    setResponseTime(null);
    setResponseHeaders({});

    const options: RequestInit = {
      method: endpoint.method,
      headers: buildHeaders(),
    };

    if (
      endpoint.hasRequestBody &&
      requestBody.trim() &&
      !["GET", "HEAD"].includes(endpoint.method)
    ) {
      options.body = requestBody;
    }

    try {
      const res = await executePlaygroundRequest(requestUrl, options);
      setResponseStatus(res.status);
      setResponseTime(res.responseTime);
      setResponseHeaders(res.headers);

      if (res.status === 0) {
        setResponseBody(res.error ?? "Request failed");
        toast.error("Request failed — see Response tab");
        return;
      }

      const formattedBody = formatResponseBodyForDisplay(res.data);
      if (formattedBody) {
        setResponseBody(formattedBody);
      } else if (res.error) {
        setResponseBody(res.error);
      } else {
        setResponseBody("");
      }

      if (!res.error && res.status >= 200 && res.status < 300) {
        toast.success(`Request completed (${res.status})`);
      } else if (res.status >= 400) {
        toast.error(`Request failed (${res.status})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setResponseBody(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setActiveTab("response");
    }
  };

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCurlCopied(true);
      toast.success("cURL copied");
      setTimeout(() => setCurlCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const copyRequestUrl = async () => {
    if (!requestUrl) return;
    try {
      await navigator.clipboard.writeText(requestUrl);
      setUrlCopied(true);
      toast.success("URL copied");
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const operationLabel =
    endpoint?.summary?.trim() ||
    endpoint?.description?.trim() ||
    null;

  const operationSamples = useMemo(() => {
    if (!endpoint || !methodData) return null;
    return getOperationSamples(
      baseUrl,
      endpoint.path,
      methodData,
      endpoint.parameters,
      apiData.components
    );
  }, [endpoint, methodData, baseUrl, apiData.components]);

  const formatBody = () => {
    const formatted = formatJsonBody(requestBody);
    if (formatted) setRequestBody(formatted);
    else toast.error("Invalid JSON");
  };

  const renderParamField = (p: OpenApiParameter) => {
    const value =
      p.in === "header"
        ? (headerValues[p.name] ?? "")
        : (paramValues[p.name] ?? "");
    const setValue = (v: string) => {
      if (p.in === "header") {
        setHeaderValues((prev) => ({ ...prev, [p.name]: v }));
      } else {
        setParamValues((prev) => ({ ...prev, [p.name]: v }));
      }
    };
    const enums = p.schema?.enum;

    return (
      <div key={`${p.in}-${p.name}`} className="space-y-1">
        <Label className="text-xs font-medium flex items-center gap-1 flex-wrap">
          {p.name}
          {p.required && <span className="text-destructive">*</span>}
          <span className="text-muted-foreground font-normal">({p.in})</span>
          <span className="text-[10px] font-mono text-muted-foreground font-normal">
            {schemaTypeLabel(p.schema)}
          </span>
        </Label>
        {p.description && (
          <p className="text-[10px] text-muted-foreground">{p.description}</p>
        )}
        {enums && enums.length > 0 ? (
          <Select value={value || undefined} onValueChange={setValue}>
            <SelectTrigger className="h-8 text-sm font-mono">
              <SelectValue placeholder={`Select ${p.name}`} />
            </SelectTrigger>
            <SelectContent>
              {enums.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {String(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 font-mono text-sm"
            placeholder={defaultPlaceholder(p)}
          />
        )}
      </div>
    );
  };

  const renderParamFields = (params: OpenApiParameter[], label: string) =>
    params.length === 0 ? (
      <p className="text-xs text-muted-foreground py-2">No {label} parameters</p>
    ) : (
      <div className="space-y-3">{params.map(renderParamField)}</div>
    );

  if (!endpoint) {
    return (
      <div
        id="playground-try-it"
        className="flex flex-1 items-center justify-center p-8 text-center min-h-0 bg-white"
      >
        <div className="max-w-md space-y-4">
          <p className="text-lg font-semibold text-foreground">
            Select an endpoint
          </p>
          <p className="text-sm text-muted-foreground">
            {totalEndpoints > 0 ? (
              <>
                This spec has{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {totalEndpoints}
                </span>{" "}
                operations. Pick one from the list on the left to build and send
                requests.
              </>
            ) : (
              "Choose an operation from the list to build and send requests."
            )}
          </p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Endpoints with a lock icon require a Bearer token in the toolbar.
          </p>
          {totalEndpoints > 0 && onSelectFirst && (
            <Button variant="outline" size="sm" onClick={onSelectFirst}>
              Open first endpoint
            </Button>
          )}
        </div>
      </div>
    );
  }

  const authWarning =
    endpoint.requiresAuth && !activeTokenValue;

  return (
    <div
      id="playground-try-it"
      className="flex flex-col h-full min-h-0 bg-white"
    >
      <div className="shrink-0 border-b border-border bg-white px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <MethodBadge
            method={endpoint.method}
            className="shrink-0 text-[10px] px-1.5 py-0 min-w-13 justify-center"
          />
          <span
            className="font-mono text-sm text-foreground truncate shrink-0 max-w-[42%]"
            title={endpoint.path}
          >
            {endpoint.path}
          </span>
          {operationLabel && (
            <span
              className="text-sm text-muted-foreground truncate min-w-0 flex-1"
              title={operationLabel}
            >
              {operationLabel}
            </span>
          )}
          {endpoint.requiresAuth && (
            <Lock
              className="h-3.5 w-3.5 text-muted-foreground shrink-0"
              aria-label="Requires authentication"
            />
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
            URL
          </span>
          <Input
            value={requestUrl}
            onChange={(e) => setRequestUrl(e.target.value)}
            className="h-8 flex-1 min-w-0 font-mono text-xs"
            placeholder="http://localhost:9090/api/v3/survey?size=1"
            spellCheck={false}
            aria-label="Request URL"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={syncRequestUrlFromParams}
            aria-label="Rebuild URL from parameters"
            title="Reset URL to environment base URL and parameters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={copyRequestUrl}
            aria-label="Copy request URL"
          >
            {urlCopied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 min-h-0 flex flex-col gap-0 px-6 pt-4 bg-white"
        >
          <TabsList className="h-9 shrink-0 w-fit mb-3">
            <TabsTrigger value="params" className="text-xs">
              Parameters
            </TabsTrigger>
            <TabsTrigger value="request" className="text-xs">
              Request
            </TabsTrigger>
            <TabsTrigger value="response" className="text-xs">
              Response
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="params"
            className="flex-1 min-h-0 overflow-y-auto mt-0 space-y-4 data-[state=inactive]:hidden"
          >
            {pathParams.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Path
                </p>
                {renderParamFields(pathParams, "path")}
              </div>
            )}
            {queryParams.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Query
                </p>
                {renderParamFields(queryParams, "query")}
              </div>
            )}
            {headerParams.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Headers
                </p>
                {renderParamFields(headerParams, "header")}
              </div>
            )}
            {pathParams.length === 0 &&
              queryParams.length === 0 &&
              headerParams.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  This operation has no parameters.
                </p>
              )}
            <OperationSamples samples={operationSamples} />
          </TabsContent>

          <TabsContent
            value="request"
            className="flex-1 min-h-0 overflow-y-auto mt-0 space-y-4 data-[state=inactive]:hidden"
          >
            {authWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                This endpoint requires a Bearer token. Add or select a role token
                in the toolbar above.
              </div>
            )}
            {endpoint.hasRequestBody ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Body
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={formatBody}
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                    Format JSON
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={resetSampleBody}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to sample
                  </Button>
                </div>
                <JsonBodyEditor
                  value={requestBody}
                  onChange={setRequestBody}
                  minHeight="220px"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This operation has no request body.
              </p>
            )}
            <Collapsible open={curlOpen} onOpenChange={setCurlOpen}>
              <div className="flex items-center justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 px-2"
                  >
                    cURL
                    {curlOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                {curlOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={copyCurl}
                  >
                    {curlCopied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy
                  </Button>
                )}
              </div>
              <CollapsibleContent className="mt-2">
                <pre className="text-[11px] font-mono bg-white rounded-md border p-3 overflow-x-auto whitespace-pre-wrap break-all">
                  {curlCommand}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent
            value="response"
            className="flex-1 min-h-0 flex flex-col mt-0 -mx-6 overflow-hidden data-[state=inactive]:hidden"
          >
            <ResponseViewer
              embedded
              status={responseStatus}
              responseTime={responseTime}
              body={responseBody}
              headers={responseHeaders}
            />
          </TabsContent>
        </Tabs>

        <div className="shrink-0 sticky bottom-0 z-10 border-t border-border bg-white px-6 py-3 flex flex-wrap items-center gap-3">
          <Button className="gap-2" onClick={execute} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Execute
          </Button>
          {responseStatus != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Last: {responseStatus}
              {responseTime != null && ` · ${responseTime} ms`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
