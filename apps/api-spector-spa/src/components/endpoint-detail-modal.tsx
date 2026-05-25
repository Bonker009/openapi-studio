"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import RandExp from "randexp";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, X, Copy } from "lucide-react";
import {
  MarkdownEditor,
  type MarkdownSaveStatus,
} from "./markdown-editor";
import { MarkdownHelpModal } from "./markdown-help-modal";
import { EndpointChangelog } from "@/components/endpoint-changelog";
import { resolveDefaultBaseUrl } from "@/lib/playground/resolve-base-url";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { MethodBadge } from "@/components/method-badge";
import { CodeBlock } from "@/components/endpoint-modal/code-block";
import { toast } from "sonner";
import {
  getRequestBodySchema,
  getResponseBodySchema,
  resolveOpenApiSchema,
  schemaRefLabel,
  schemaTypeLabel,
} from "@/lib/openapi-schema";

const tabPanelClass =
  "mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4 outline-none data-[state=inactive]:hidden";

function ModalTabPanel({ children }: { children: ReactNode }) {
  return <div className="pb-6 pr-1">{children}</div>;
}

type EndpointDetailModalProps = {
  specId: string;
  isOpen: boolean;
  onClose: () => void;
  endpoint: any;
  path: string;
  method: string;
  apiData: any;
  status: {
    working: boolean;
    notes: string;
  };
  onToggleStatus: (path: string, method: string) => void;
  onUpdateNotes: (path: string, method: string, notes: string) => void;
  getControllerBadgeStyle: (controller: string) => CSSProperties;
};

export function EndpointDetailModal({
  specId,
  isOpen,
  onClose,
  endpoint,
  path,
  method,
  apiData,
  status,
  onToggleStatus,
  onUpdateNotes,
  getControllerBadgeStyle,
}: EndpointDetailModalProps) {
  const [draft, setDraft] = useState(status.notes || "");
  const [saveStatus, setSaveStatus] = useState<MarkdownSaveStatus>("idle");

  useEffect(() => {
    setDraft(status.notes || "");
    setSaveStatus("idle");
  }, [path, method, status.notes, isOpen]);

  useEffect(() => {
    if (!isOpen || !endpoint) return;
    const saved = status.notes || "";
    if (draft === saved) {
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await onUpdateNotes(path, method, draft);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("idle");
        }
      })();
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, path, method, isOpen, endpoint, status.notes]);

  if (!endpoint) return null;

  const methodData = apiData.paths[path][method.toLowerCase()];

  const copyPath = () => {
    navigator.clipboard
      .writeText(path)
      .then(() => toast.success("Path copied"))
      .catch(() => toast.error("Failed to copy path"));
  };

  function generateSampleRequest(schema: any, components: any): any {
    if (!schema) return null;

    if (schema.$ref) {
      const refPath = schema.$ref.replace("#/components/schemas/", "");
      if (components?.schemas?.[refPath]) {
        return generateSampleRequest(components.schemas[refPath], components);
      }
      return { refPath: "Reference not found" };
    }

    if (schema.type === "object") {
      const result: any = {};
      if (schema.properties) {
        Object.keys(schema.properties).forEach((propName) => {
          const isRequired =
            schema.required && schema.required.includes(propName);
          if (isRequired) {
            result[propName] = generateSampleRequest(
              schema.properties[propName],
              components
            );
          }
        });
      }
      return result;
    } else if (schema.type === "array") {
      return [generateSampleRequest(schema.items, components)];
    } else if (schema.type === "string") {
      if (schema.format === "date-time") return "2023-01-01T12:00:00Z";
      if (schema.format === "date") return "2023-01-01";
      if (schema.format === "uuid")
        return "123e4567-e89b-12d3-a456-426614174000";
      if (schema.format === "email") return "user@example.com";
      if (schema.format === "uri") return "https://example.com";
      if (schema.enum) return schema.enum[0];
      if (schema.pattern) {
        try {
          const pattern = new RegExp(schema.pattern);
          return new RandExp(pattern).gen();
        } catch (err) {
          return `Invalid regex pattern: ${schema.pattern}`;
        }
      }
      return "string value";
    } else if (schema.type === "integer" || schema.type === "number") {
      if (schema.minimum !== undefined && schema.maximum !== undefined) {
        return Math.floor((schema.minimum + schema.maximum) / 2);
      }
      if (schema.minimum !== undefined) return schema.minimum;
      if (schema.maximum !== undefined) return schema.maximum;
      return schema.type === "integer" ? 42 : 42.5;
    } else if (schema.type === "boolean") {
      return true;
    } else if (schema.oneOf || schema.anyOf) {
      const options = schema.oneOf || schema.anyOf;
      return generateSampleRequest(options[0], components);
    }

    return null;
  }

  const requestBodySchema = getRequestBodySchema(methodData);
  const responseBodySchema = getResponseBodySchema(methodData);

  const resolvedRequestSchema = requestBodySchema
    ? resolveOpenApiSchema(requestBodySchema, apiData.components)
    : null;
  const resolvedResponseSchema = responseBodySchema
    ? resolveOpenApiSchema(responseBodySchema, apiData.components)
    : null;

  const requestSample = requestBodySchema
    ? generateSampleRequest(requestBodySchema, apiData.components)
    : null;

  const responseSample = responseBodySchema
    ? generateSampleRequest(responseBodySchema, apiData.components)
    : null;

  const baseUrl = resolveDefaultBaseUrl({ servers: apiData.servers });

  const buildSampleUrl = () => {
    const resolvedPath = path.replace(/{([^}]+)}/g, (match, param) => {
      const parameter = methodData.parameters?.find(
        (p: any) => p.name === param
      );
      if (parameter?.schema?.format === "uuid") {
        return "123e4567-e89b-12d3-a456-426614174000";
      }
      return match;
    });
    const query = (methodData.parameters ?? [])
      .filter((p: any) => p.in === "query")
      .map((p: any, i: number) => {
        let value = "value";
        if (p.schema?.type === "boolean") value = "true";
        if (p.schema?.type === "integer") value = "1";
        return `${i > 0 ? "&" : ""}${p.name}=${value}`;
      })
      .join("");
    return `${baseUrl}${resolvedPath}${query ? `?${query}` : ""}`;
  };

  const responseCodeVariant = (code: string) => {
    if (code.startsWith("2")) return "bg-success/10 text-success border-success/30";
    if (code.startsWith("4"))
      return "bg-destructive/10 text-destructive border-destructive/20";
    if (code.startsWith("5")) return "bg-warning/10 text-warning border-warning/30";
    return "bg-primary/10 text-primary border-primary/20";
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full max-h-[100dvh] flex-col gap-0 overflow-hidden p-0 w-full sm:max-w-none sm:w-[min(95vw,1100px)]"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 space-y-3 text-left">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-left text-base sm:text-lg font-semibold">
            <MethodBadge method={method} className="text-xs" />
            <span className="font-mono font-medium break-all">{path}</span>
          </SheetTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2 pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={copyPath}
                >
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copy path</span>
                </Button>
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-muted-foreground">
                  {methodData.operationId}
                </span>
                {methodData.tags?.map((tag: string) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    style={getControllerBadgeStyle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </SheetDescription>
            </div>
            <Button
              variant={status.working ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleStatus(path, method)}
              className="shrink-0 flex items-center"
            >
              {status.working ? (
                <>
                  <Check className="h-4 w-4 mr-1" /> Working
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" /> Not Working
                </>
              )}
            </Button>
          </div>
        </SheetHeader>

        <Tabs
          defaultValue="details"
          className="flex min-h-0 flex-1 flex-col overflow-hidden gap-0"
        >
          <div className="shrink-0 border-b bg-background px-6 py-2">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1">
              <TabsTrigger value="details" className="text-xs sm:text-sm">
                Details
              </TabsTrigger>
              <TabsTrigger value="schema" className="text-xs sm:text-sm">
                Schema
              </TabsTrigger>
              <TabsTrigger value="request" className="text-xs sm:text-sm">
                Request
              </TabsTrigger>
              <TabsTrigger value="response" className="text-xs sm:text-sm">
                Response
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs sm:text-sm">
                Notes
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className={tabPanelClass}>
            <ModalTabPanel>
            <div className="space-y-6">
            {/* Parameters Section */}
            <Accordion
              type="multiple"
              defaultValue={["parameters", "requestBody", "responses"]}
            >
              <AccordionItem value="parameters">
                <AccordionTrigger className="text-base font-semibold">
                  Parameters
                </AccordionTrigger>
                <AccordionContent>
                  {methodData.parameters && methodData.parameters.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>In</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {methodData.parameters.map(
                            (param: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">
                                  {param.name}
                                </TableCell>
                                <TableCell>{param.in}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {schemaTypeLabel(param.schema)}
                                </TableCell>
                                <TableCell>
                                  {param.required ? (
                                    <Badge variant="brand">Yes</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      No
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {param.description || "-"}
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic px-2 py-4">
                      No parameters for this endpoint.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Request Body Section */}
              <AccordionItem value="requestBody">
                <AccordionTrigger className="text-base font-semibold">
                  Request Body
                </AccordionTrigger>
                <AccordionContent>
                  {methodData.requestBody ? (
                    <div className="space-y-4">
                      {Object.entries(
                        methodData.requestBody.content as Record<
                          string,
                          { schema?: unknown }
                        >
                      ).map(([contentType, content]) =>
                          content.schema ? (
                            <div
                              key={contentType}
                              className="rounded-md border bg-muted/30 p-4 space-y-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{contentType}</Badge>
                                {schemaRefLabel(content.schema) && (
                                  <span className="font-mono text-sm text-muted-foreground">
                                    {schemaRefLabel(content.schema)}
                                  </span>
                                )}
                                {methodData.requestBody.required && (
                                  <Badge variant="destructive">Required</Badge>
                                )}
                              </div>
                              <CodeBlock
                                code={JSON.stringify(
                                  resolveOpenApiSchema(
                                    content.schema,
                                    apiData.components
                                  ),
                                  null,
                                  2
                                )}
                                maxHeight="max-h-[320px]"
                              />
                            </div>
                          ) : (
                            <p
                              key={contentType}
                              className="text-sm text-muted-foreground"
                            >
                              {contentType}: no schema
                            </p>
                          )
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic px-2 py-4">
                      No request body required.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="responses">
                <AccordionTrigger className="text-base font-semibold">
                  Responses
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Content Type</TableHead>
                          <TableHead>Schema</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(methodData.responses).map(
                          ([code, response]: [string, any]) => (
                            <TableRow key={code}>
                              <TableCell className="font-medium tabular-nums">
                                {code}
                              </TableCell>
                              <TableCell>{response.description}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {response.content
                                  ? Object.keys(response.content).join(", ")
                                  : "-"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {response.content
                                  ? Object.values(response.content).map(
                                      (content: any, i: number) => (
                                        <div key={i}>
                                          {schemaTypeLabel(content.schema)}
                                        </div>
                                      )
                                    )
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {Object.entries(methodData.responses).flatMap(
                    ([code, response]: [string, any]) =>
                      response.content
                        ? Object.entries(response.content)
                            .filter(([, c]: [string, any]) => c.schema)
                            .map(([contentType, c]: [string, any]) => (
                              <div
                                key={`${code}-${contentType}`}
                                className="rounded-md border bg-muted/30 p-4 space-y-3"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <Badge
                                    variant="outline"
                                    className={responseCodeVariant(code)}
                                  >
                                    {code}
                                  </Badge>
                                  <Badge variant="outline">{contentType}</Badge>
                                  {schemaRefLabel(c.schema) && (
                                    <span className="font-mono text-muted-foreground">
                                      {schemaRefLabel(c.schema)}
                                    </span>
                                  )}
                                </div>
                                <CodeBlock
                                  code={JSON.stringify(
                                    resolveOpenApiSchema(
                                      c.schema,
                                      apiData.components
                                    ),
                                    null,
                                    2
                                  )}
                                  maxHeight="max-h-[280px]"
                                />
                              </div>
                            ))
                        : []
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </div>
            </ModalTabPanel>
          </TabsContent>

          <TabsContent value="schema" className={tabPanelClass}>
            <ModalTabPanel>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2 flex flex-wrap items-center gap-2">
                    <span>Request schema</span>
                    {schemaRefLabel(requestBodySchema) && (
                      <Badge variant="outline" className="font-mono font-normal">
                        {schemaRefLabel(requestBodySchema)}
                      </Badge>
                    )}
                  </h3>
                  {resolvedRequestSchema ? (
                    <CodeBlock
                      code={JSON.stringify(resolvedRequestSchema, null, 2)}
                      maxHeight="max-h-none"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No request schema available
                    </p>
                  )}
                </div>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2 flex flex-wrap items-center gap-2">
                    <span>Response schema</span>
                    {schemaRefLabel(responseBodySchema) && (
                      <Badge variant="outline" className="font-mono font-normal">
                        {schemaRefLabel(responseBodySchema)}
                      </Badge>
                    )}
                  </h3>
                  {resolvedResponseSchema ? (
                    <CodeBlock
                      code={JSON.stringify(resolvedResponseSchema, null, 2)}
                      maxHeight="max-h-none"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No response schema available
                    </p>
                  )}
                </div>
              </div>
            </ModalTabPanel>
          </TabsContent>

          <TabsContent value="request" className={tabPanelClass}>
            <ModalTabPanel>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Sample request body</h3>
                  {requestSample ? (
                    <CodeBlock
                      code={JSON.stringify(requestSample, null, 2)}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm p-4 rounded-md border bg-muted/30">
                      No request body required
                    </p>
                  )}
                </div>
                {methodData.parameters?.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">Sample request URL</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(buildSampleUrl());
                            toast.success("URL copied");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                      </div>
                      <code className="block text-xs sm:text-sm font-mono break-all rounded-md border bg-muted/30 p-4">
                        {buildSampleUrl()}
                      </code>
                    </div>
                  </>
                )}
              </div>
            </ModalTabPanel>
          </TabsContent>

          <TabsContent value="response" className={tabPanelClass}>
            <ModalTabPanel>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Sample response (200 OK)</h3>
                  {responseSample ? (
                    <CodeBlock
                      code={JSON.stringify(responseSample, null, 2)}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm p-4 rounded-md border bg-muted/30">
                      No response schema available
                    </p>
                  )}
                </div>

                {Object.entries(methodData.responses).length > 1 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-2">Other response codes</h3>
                      <Accordion type="single" collapsible className="w-full">
                        {Object.entries(methodData.responses)
                          .filter(([code]) => code !== "200")
                          .map(([code, response]: [string, any]) => (
                            <AccordionItem key={code} value={code}>
                              <AccordionTrigger className="px-4 py-2 hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={responseCodeVariant(code)}
                                  >
                                    {code}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {response.description}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pt-2">
                                <CodeBlock
                                  code={JSON.stringify(
                                    {
                                      success: code.startsWith("2"),
                                      message: response.description,
                                      status: code,
                                      payload: null,
                                      timestamp: new Date().toISOString(),
                                    },
                                    null,
                                    2
                                  )}
                                />
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                      </Accordion>
                    </div>
                  </>
                )}

                {methodData.responses["200"]?.content?.["*/*"]?.schema &&
                  responseSample && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-medium mb-2">Response structure</h3>
                        <ul className="space-y-2 rounded-md border bg-muted/30 p-4">
                          {Object.entries(responseSample).map(
                            ([key, value]) => (
                              <li
                                key={key}
                                className="text-sm flex flex-wrap items-center gap-2"
                              >
                                <span className="font-semibold">{key}</span>
                                <Badge variant="outline">
                                  {typeof value === "object"
                                    ? Array.isArray(value)
                                      ? "Array"
                                      : "Object"
                                    : typeof value}
                                </Badge>
                                {typeof value !== "object" &&
                                  String(value).length < 50 && (
                                    <span className="text-muted-foreground text-xs">
                                      e.g. {String(value)}
                                    </span>
                                  )}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </>
                  )}
              </div>
            </ModalTabPanel>
          </TabsContent>

          <TabsContent value="notes" className={tabPanelClass}>
            <ModalTabPanel>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium">Notes</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Markdown supported. Auto-saved.
                  </p>
                </div>
                <MarkdownHelpModal />
              </div>
              <MarkdownEditor
                key={`${path}-${method}`}
                value={draft}
                onChange={setDraft}
                saveStatus={saveStatus}
                placeholder={
                  status.working
                    ? "Add notes about this endpoint using Markdown...\n\n## Usage\n\n## Examples\n\n## Notes"
                    : "Add comments about why this endpoint is not working using Markdown...\n\n## Issues\n\n## Workarounds\n\n## Todo"
                }
                height="min-h-[280px]"
              />
              <EndpointChangelog
                specId={specId}
                path={path}
                method={method}
                isOpen={isOpen}
              />
            </ModalTabPanel>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
