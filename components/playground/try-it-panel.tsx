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
  LockOpen,
  RotateCcw,
  AlignLeft,
} from "lucide-react";
import { MethodBadge } from "@/components/method-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JsonBodyEditorLazy } from "@/components/playground/json-body-editor-lazy";
import { MultipartBodyEditor } from "@/components/playground/multipart-body-editor";
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
import {
  applyAuthToRequest,
  authHeadersForCurl,
  authQueryForUrl,
} from "@/lib/playground/apply-auth";
import {
  credentialRequiresAuth,
  type Credential,
} from "@/lib/playground/credentials";
import { assertPlaygroundRequestUrl } from "@/lib/playground/url-policy";
import {
  buildRequestUrl,
  defaultParamValues,
  rebuildRequestUrlPreservingOrigin,
} from "@/lib/playground/build-request";
import { buildCurlCommand, type CurlBodyInput } from "@/lib/playground/build-curl";
import {
  buildFormData,
  createMultipartStateFromFields,
  estimateFormDataSize,
  validateMultipartState,
  type MultipartBodyState,
} from "@/lib/playground/build-form-data";
import {
  getRequestBodyInfo,
  type RequestBodyKind,
} from "@/lib/playground/request-body";
import { MAX_PROXY_BODY_BYTES } from "@/lib/security/outbound-headers";
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
  activeCredential: Credential | null;
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
  activeCredential,
  totalEndpoints = 0,
  onSelectFirst,
}: TryItPanelProps) {
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState("{}");
  const [multipartState, setMultipartState] = useState<MultipartBodyState>({
    rows: [],
  });
  const [binaryFile, setBinaryFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState("");
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [requestUrl, setRequestUrl] = useState("");
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("request");
  const [querySectionOpen, setQuerySectionOpen] = useState(true);
  const [headersSectionOpen, setHeadersSectionOpen] = useState(false);
  const [bodySectionOpen, setBodySectionOpen] = useState(true);
  const skipOriginPreserveRef = useRef(false);

  const methodData = useMemo(() => {
    if (!endpoint || !apiData.paths) return null;
    const methods = apiData.paths[endpoint.path] as
      | Record<string, unknown>
      | undefined;
    return methods?.[endpoint.method.toLowerCase()] as Record<string, unknown> | null;
  }, [endpoint, apiData]);

  const requestBodyInfo = useMemo(
    () => getRequestBodyInfo(methodData, apiData.components),
    [methodData, apiData.components]
  );

  const bodyKind: RequestBodyKind = requestBodyInfo.kind;

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

  useEffect(() => {
    setQuerySectionOpen(queryParams.length > 0);
    setHeadersSectionOpen(false);
    setBodySectionOpen(Boolean(endpoint?.hasRequestBody));
  }, [endpoint, queryParams.length]);

  const resetMultipartBody = useCallback(() => {
    setMultipartState(
      createMultipartStateFromFields(requestBodyInfo.multipartFields)
    );
  }, [requestBodyInfo.multipartFields]);

  const resetSampleBody = useCallback(() => {
    if (!methodData || !endpoint?.hasRequestBody) {
      setRequestBody("");
      setMultipartState({ rows: [] });
      setBinaryFile(null);
      return;
    }
    if (bodyKind === "multipart") {
      resetMultipartBody();
      return;
    }
    if (bodyKind === "binary") {
      setBinaryFile(null);
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
  }, [
    methodData,
    endpoint,
    baseUrl,
    apiData.components,
    bodyKind,
    resetMultipartBody,
  ]);

  useEffect(() => {
    if (!endpoint) return;
    setParamValues(defaultParamValues(endpoint.parameters));
    setHeaderValues(defaultParamValues(headerParams));
    setResponseStatus(null);
    setResponseTime(null);
    setResponseBody("");
    setResponseHeaders({});
    resetSampleBody();
    setActiveTab("request");
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
    if (
      endpoint?.hasRequestBody &&
      bodyKind === "json" &&
      requestBody.trim()
    ) {
      headers["Content-Type"] = "application/json";
    }
    headerParams.forEach((p) => {
      const v = headerValues[p.name]?.trim();
      if (v) headers[p.name] = v;
    });
    if (endpoint?.requiresAuth) {
      Object.assign(headers, authHeadersForCurl(activeCredential));
    }
    return headers;
  }, [
    endpoint,
    requestBody,
    bodyKind,
    headerParams,
    headerValues,
    activeCredential,
  ]);

  const curlBodyInput = useMemo((): CurlBodyInput | undefined => {
    if (!endpoint?.hasRequestBody) return undefined;
    if (bodyKind === "multipart") {
      return { type: "multipart", rows: multipartState.rows };
    }
    if (bodyKind === "binary") {
      return { type: "binary", file: binaryFile };
    }
    return { type: "json", text: requestBody };
  }, [endpoint, bodyKind, multipartState.rows, binaryFile, requestBody]);

  const curlCommand = useMemo(() => {
    if (!endpoint) return "";
    let url = requestUrl;
    const q = authQueryForUrl(activeCredential, endpoint.requiresAuth);
    for (const [k, v] of Object.entries(q)) {
      try {
        const u = new URL(url);
        u.searchParams.set(k, v);
        url = u.toString();
      } catch {
        /* keep url */
      }
    }
    return buildCurlCommand(url, endpoint.method, buildHeaders(), curlBodyInput);
  }, [endpoint, requestUrl, buildHeaders, curlBodyInput, activeCredential]);

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
      !["GET", "HEAD"].includes(endpoint.method)
    ) {
      if (bodyKind === "multipart") {
        const validationError = validateMultipartState(multipartState);
        if (validationError) {
          toast.error(validationError);
          setLoading(false);
          return;
        }
        const size = estimateFormDataSize(multipartState);
        if (size > MAX_PROXY_BODY_BYTES) {
          toast.error(
            `Request body exceeds ${MAX_PROXY_BODY_BYTES / (1024 * 1024)} MB limit`
          );
          setLoading(false);
          return;
        }
        options.body = buildFormData(multipartState);
      } else if (bodyKind === "binary") {
        if (!binaryFile) {
          toast.error("Select a file to upload");
          setLoading(false);
          return;
        }
        if (binaryFile.size > MAX_PROXY_BODY_BYTES) {
          toast.error(
            `File exceeds ${MAX_PROXY_BODY_BYTES / (1024 * 1024)} MB limit`
          );
          setLoading(false);
          return;
        }
        options.body = binaryFile;
      } else if (requestBody.trim()) {
        options.body = requestBody;
      }
    }

    const authed = applyAuthToRequest(
      activeCredential,
      requestUrl,
      options,
      endpoint.requiresAuth
    );

    try {
      const res = await executePlaygroundRequest(authed.url, authed.init);
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
      setActiveTab("request");
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

    const fieldId = `param-${p.in}-${p.name}`;
    return (
      <div key={`${p.in}-${p.name}`} className="space-y-1">
        <Label
          htmlFor={fieldId}
          className="text-xs font-medium flex items-center gap-1 flex-wrap"
        >
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
            <SelectTrigger id={fieldId} className="h-8 text-sm font-mono">
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
            id={fieldId}
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
        className="flex flex-1 items-center justify-center p-8 text-center min-h-0 bg-card"
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
    endpoint.requiresAuth && !credentialRequiresAuth(activeCredential);
  const authSatisfied = credentialRequiresAuth(activeCredential);

  return (
    <div
      id="playground-try-it"
      className="flex flex-col flex-1 min-h-0 bg-card"
    >
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 space-y-2.5">
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
          {endpoint.requiresAuth &&
            (authSatisfied ? (
              <LockOpen
                className="h-3.5 w-3.5 shrink-0 text-success"
                aria-label="Authentication applied"
              />
            ) : (
              <Lock
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-label="Requires authentication"
              />
            ))}
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
          className="flex-1 min-h-0 flex flex-col gap-0 px-6 pt-4 bg-card"
        >
          <TabsList className="h-9 shrink-0 w-fit mb-3">
            <TabsTrigger value="request" className="text-xs">
              Request & Response
            </TabsTrigger>
            <TabsTrigger value="samples" className="text-xs">
              Samples
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="request"
            className="mt-0 flex flex-col flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 xl:flex-row">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 pr-1 xl:min-w-0">
                <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Request
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Path and URL are always visible; expand sections below as
                        needed.
                      </p>
                    </div>
                    {responseStatus != null && (
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground tabular-nums shrink-0">
                        Last {responseStatus}
                        {responseTime != null && ` · ${responseTime} ms`}
                      </span>
                    )}
                  </div>

                  {pathParams.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Path
                      </p>
                      {renderParamFields(pathParams, "path")}
                    </div>
                  )}
                  {queryParams.length > 0 && (
                    <Collapsible
                      open={querySectionOpen}
                      onOpenChange={setQuerySectionOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-between px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                        >
                          Query ({queryParams.length})
                          {querySectionOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        {renderParamFields(queryParams, "query")}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  {headerParams.length > 0 && (
                    <Collapsible
                      open={headersSectionOpen}
                      onOpenChange={setHeadersSectionOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-between px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                        >
                          Headers ({headerParams.length})
                          {headersSectionOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        {renderParamFields(headerParams, "header")}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  {pathParams.length === 0 &&
                    queryParams.length === 0 &&
                    headerParams.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        This operation has no parameters.
                      </p>
                    )}

                  {authWarning && (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                      This endpoint requires a Bearer token. Add or select a role
                      token in the toolbar above.
                    </div>
                  )}
                </div>

                <Collapsible
                  open={bodySectionOpen}
                  onOpenChange={setBodySectionOpen}
                  className="rounded-xl border border-border bg-background"
                >
                  <div className="flex items-center justify-between gap-2 p-3 pb-0">
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 flex-1 justify-between px-2 text-xs font-semibold text-foreground"
                      >
                        {endpoint.hasRequestBody
                          ? `Body${requestBodyInfo.contentType ? ` (${requestBodyInfo.contentType})` : ""}`
                          : "Body"}
                        {bodySectionOpen ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="p-4 pt-3 space-y-3">
                  {endpoint.hasRequestBody ? (
                    <div className="space-y-2">
                      <Label id="request-body-label" className="sr-only">
                        Request body
                      </Label>
                      {bodyKind === "json" && (
                        <>
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
                          <JsonBodyEditorLazy
                            value={requestBody}
                            onChange={setRequestBody}
                            minHeight="220px"
                            aria-labelledby="request-body-label"
                          />
                        </>
                      )}
                      {bodyKind === "multipart" && (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={resetSampleBody}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reset fields
                            </Button>
                          </div>
                          <MultipartBodyEditor
                            state={multipartState}
                            onChange={setMultipartState}
                          />
                        </>
                      )}
                      {bodyKind === "binary" && (
                        <div className="space-y-2">
                          <input
                            type="file"
                            className="text-sm"
                            onChange={(e) =>
                              setBinaryFile(e.target.files?.[0] ?? null)
                            }
                          />
                          {binaryFile && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {binaryFile.name} ({" "}
                              {(binaryFile.size / 1024).toFixed(1)} KB)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This operation has no request body.
                    </p>
                  )}
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible
                  open={curlOpen}
                  onOpenChange={setCurlOpen}
                  className="rounded-xl border border-border bg-background p-3"
                >
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
                    <pre className="text-[11px] font-mono bg-card rounded-md border p-3 overflow-x-auto whitespace-pre-wrap break-all">
                      {curlCommand}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="flex min-h-[min(360px,40vh)] flex-col overflow-hidden rounded-xl border border-border bg-background xl:min-h-0 xl:min-w-[300px] xl:flex-[1.05]">
                <ResponseViewer
                  embedded
                  status={responseStatus}
                  responseTime={responseTime}
                  body={responseBody}
                  headers={responseHeaders}
                  placeholder="Execute the request to see the response here"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="samples"
            className="flex-1 min-h-0 overflow-y-auto mt-0 data-[state=inactive]:hidden"
          >
            {operationSamples ? (
              <OperationSamples samples={operationSamples} standalone />
            ) : (
              <p className="text-xs text-muted-foreground">
                No samples in the spec for this operation.
              </p>
            )}
          </TabsContent>

        </Tabs>

        <div className="shrink-0 sticky bottom-0 z-10 border-t border-border bg-card px-6 py-3 flex flex-wrap items-center gap-3">
          <Button className="gap-2" onClick={execute} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Execute
          </Button>
          {responseStatus != null && (
            <span
              role="status"
              aria-live="polite"
              className="text-xs text-muted-foreground tabular-nums"
            >
              Last: {responseStatus}
              {responseTime != null && ` · ${responseTime} ms`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
