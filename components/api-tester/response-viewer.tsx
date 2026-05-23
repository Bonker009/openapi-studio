"use client";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Copy,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  XCircle,
  Info,
  Code,
  FileJson,
  FileText,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ResponseViewerProps } from "@/app/types/types";
import { cn } from "@/lib/utils";

export function ResponseViewer({
  responseStatus,
  responseTime,
  responseBody,
  responseHeaders,
  getStatusBadgeColor,
  copyToClipboard,
}: ResponseViewerProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [isJsonView, setIsJsonView] = useState<boolean>(true);
  const [highlightedBody, setHighlightedBody] = useState<string>("");
  const [responseSize, setResponseSize] = useState<number>(0);

  const formattedBody = responseBody || "";

  useEffect(() => {
    try {
      if (responseBody) {
        setResponseSize(new Blob([responseBody]).size);

        if (
          responseBody.trim().startsWith("{") ||
          responseBody.trim().startsWith("[")
        ) {
          const parsed = JSON.parse(responseBody);
          const formatted = JSON.stringify(parsed, null, 2);
          setHighlightedBody(formatted);
          setIsJsonView(true);
        } else {
          setHighlightedBody(responseBody);
          setIsJsonView(false);
        }
      } else {
        setHighlightedBody("");
        setResponseSize(0);
      }
    } catch (e) {
      setHighlightedBody(responseBody || "");
      setIsJsonView(false);
    }
  }, [responseBody]);

  const handleCopy = (text: string, type: string) => {
    copyToClipboard(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  function getStatusInfo(status: number | null) {
    if (!status)
      return {
        color: "bg-gray-100 text-gray-800",
        icon: Info,
        text: "Waiting",
      };

    if (status >= 200 && status < 300) {
      return {
        color: "bg-success/10 text-success",
        icon: CheckCircle2,
        text: "Success",
      };
    } else if (status >= 400 && status < 500) {
      return {
        color: "bg-destructive/10 text-destructive",
        icon: AlertCircle,
        text: "Client Error",
      };
    } else if (status >= 500) {
      return {
        color: "bg-orange-100 text-orange-800",
        icon: XCircle,
        text: "Server Error",
      };
    } else {
      return {
        color: "bg-blue-100 text-blue-800",
        icon: Info,
        text: "Information",
      };
    }
  }

  const statusInfo = getStatusInfo(responseStatus);
  const StatusIcon = statusInfo.icon;

  // Calculate response time color
  const getTimeColor = (time: number | null) => {
    if (!time) return "bg-gray-100";
    if (time < 100) return "bg-success";
    if (time < 300) return "bg-success";
    if (time < 500) return "bg-yellow-400";
    if (time < 1000) return "bg-orange-500";
    return "bg-destructive";
  };

  return (
    <Card className="shadow-sm border-border h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="flex items-center">
              {responseStatus ? (
                <StatusIcon
                  className={`h-4 w-4 mr-2 ${statusInfo.color.replace(
                    "bg-",
                    "text-"
                  )}`}
                />
              ) : (
                <FileJson className="h-4 w-4 mr-2 text-muted-foreground" />
              )}
              Response
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-full"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse response" : "Expand response"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardTitle>

          <div className="flex items-center gap-3">
            {responseTime && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-xs">
                      <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                      <span>{responseTime}ms</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="text-xs">
                      <p className="font-medium mb-1">Response Time</p>
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getTimeColor(responseTime)}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(5, responseTime / 20)
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1">
                        {responseTime < 100
                          ? "Excellent"
                          : responseTime < 300
                          ? "Good"
                          : responseTime < 500
                          ? "Average"
                          : responseTime < 1000
                          ? "Slow"
                          : "Very Slow"}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {responseStatus && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      className={`${statusInfo.color} flex items-center gap-1 px-2 py-1`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      <span>{responseStatus}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>
                      <p className="font-medium">{statusInfo.text}</p>
                      <p className="text-xs mt-1">
                        {responseStatus >= 200 && responseStatus < 300
                          ? "Request processed successfully"
                          : responseStatus >= 400 && responseStatus < 500
                          ? "Client-side request issue"
                          : responseStatus >= 500
                          ? "Server-side processing error"
                          : "Informational or redirection response"}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {responseSize > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs text-muted-foreground flex items-center">
                      <FileText className="h-3 w-3 mr-1" />
                      {responseSize < 1024
                        ? `${responseSize} B`
                        : `${(responseSize / 1024).toFixed(1)} KB`}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Response size: {responseSize.toLocaleString()} bytes</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {responseStatus && (
          <CardDescription className="mt-1 flex items-center">
            <span
              className={`w-2 h-2 rounded-full ${statusInfo.color} mr-2`}
            ></span>
            {statusInfo.text}{" "}
            {responseStatus >= 200 && responseStatus < 300
              ? "- Request completed successfully"
              : "- Request encountered an issue"}
          </CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <>
          <CardContent className="pt-0">
            <Tabs defaultValue="body" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="body" className="flex items-center">
                  <FileJson className="h-3.5 w-3.5 mr-1.5" />
                  Body
                </TabsTrigger>
                <TabsTrigger value="headers" className="flex items-center">
                  <Code className="h-3.5 w-3.5 mr-1.5" />
                  Headers
                </TabsTrigger>
              </TabsList>

              <TabsContent value="body" className="mt-0">
                <div className="relative group">
                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                    {formattedBody && isJsonView && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 bg-white/80 backdrop-blur-sm"
                        onClick={() => setIsJsonView(!isJsonView)}
                      >
                        {isJsonView ? (
                          <>
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Raw</span>
                          </>
                        ) : (
                          <>
                            <FileJson className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">JSON</span>
                          </>
                        )}
                      </Button>
                    )}

                    {responseBody && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-7 px-2 ${
                          copied === "body"
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-white/80 backdrop-blur-sm"
                        }`}
                        onClick={() => handleCopy(responseBody, "body")}
                      >
                        {copied === "body" ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Copy</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="bg-muted/40 border rounded-md overflow-hidden">
                    {isJsonView ? (
                      <SyntaxHighlighter
                        language="json"
                        style={oneLight}
                        customStyle={{
                          background: "transparent",
                          fontSize: "0.95em",
                          margin: 0,
                          padding: 0,
                          minHeight: "100%",
                        }}
                      >
                        {highlightedBody}
                      </SyntaxHighlighter>
                    ) : (
                      <pre className="whitespace-pre">{formattedBody}</pre>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="headers" className="mt-0">
                <div className="relative group">
                  {Object.keys(responseHeaders).length > 0 && (
                    <div className="absolute top-2 right-2 z-10">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-7 px-2 ${
                          copied === "headers"
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-white/80 backdrop-blur-sm"
                        }`}
                        onClick={() =>
                          handleCopy(
                            JSON.stringify(responseHeaders, null, 2),
                            "headers"
                          )
                        }
                      >
                        {copied === "headers" ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {Object.keys(responseHeaders).length > 0 ? (
                    <div className="bg-muted/40 border rounded-md p-4 overflow-x-auto h-[350px]">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs uppercase font-medium text-muted-foreground pb-3 pr-6">
                              Name
                            </th>
                            <th className="text-left text-xs uppercase font-medium text-muted-foreground pb-3">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(responseHeaders).map(
                            ([key, value], index) => (
                              <tr
                                key={index}
                                className="hover:bg-muted/50 transition-colors"
                              >
                                <td className="py-3 pr-6 text-sm font-medium text-foreground align-top whitespace-nowrap">
                                  {key}
                                </td>
                                <td className="py-3 text-sm text-muted-foreground break-all">
                                  {value}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-muted/40 border rounded-md p-4 h-[350px] flex flex-col items-center justify-center text-muted-foreground">
                      <Info className="h-10 w-10 mb-2 text-muted-foreground" />
                      <p className="text-center">
                        No response headers available
                      </p>
                      <p className="text-center text-sm mt-1">
                        Headers will appear here after sending a request
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="pt-0 pb-3 px-6 flex justify-between text-xs text-muted-foreground border-t mt-2 pt-3">
            <div className="flex items-center">
              {responseStatus && responseTime && (
                <>
                  <Badge
                    variant="outline"
                    className={cn(
                      "mr-2 bg-muted/40 border-border",
                      responseStatus >= 200 &&
                        responseStatus < 300 &&
                        "bg-green-50 border-success/30 text-green-700",
                      responseStatus >= 400 &&
                        responseStatus < 500 &&
                        "bg-red-50 border-destructive/30 text-red-700",
                      responseStatus >= 500 &&
                        "bg-orange-50 border-orange-200 text-orange-700"
                    )}
                  >
                    HTTP {responseStatus}
                  </Badge>
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {responseTime}ms
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              {responseSize > 0 && (
                <span className="flex items-center">
                  <FileText className="h-3 w-3 mr-1" />
                  {responseSize < 1024
                    ? `${responseSize} bytes`
                    : `${(responseSize / 1024).toFixed(1)} KB`}
                </span>
              )}

              {Object.keys(responseHeaders).length > 0 && (
                <span className="flex items-center">
                  <Code className="h-3 w-3 mr-1" />
                  {Object.keys(responseHeaders).length} headers
                </span>
              )}
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
