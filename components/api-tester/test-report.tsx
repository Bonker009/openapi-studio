"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TestReportProps } from "@/app/types/types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useSyntaxHighlightStyle } from "@/hooks/use-syntax-highlight-style";

export function TestReport({
  testResults,
  activeResult,
  testCases,
  setActiveResult,
  getStatusBadgeColor,
  copyToClipboard,
}: TestReportProps) {
  const highlightStyle = useSyntaxHighlightStyle();
  // Summary counts
  const passed = testResults.filter(
    (r) => r.response && r.response.status >= 200 && r.response.status < 300
  ).length;
  const failed = testResults.filter(
    (r) => !r.response || r.response.status >= 400
  ).length;
  const total = testResults.length;

  const activeTestResult = testResults.find((r) => r.id === activeResult);
  const testCase = testCases.find((tc) => tc.result?.id === activeResult);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Test Report
        </CardTitle>
        <CardDescription>Summary and details of your API tests</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Bar */}
        <div className="flex gap-3 mb-4">
          <Badge className="bg-success/10 text-success">
            Passed: {passed}
          </Badge>
          <Badge className="bg-destructive/10 text-destructive">Failed: {failed}</Badge>
          <Badge className="bg-gray-100 text-gray-800">Total: {total}</Badge>
        </div>

        {/* Test Result Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {testResults.map((result) => (
            <Button
              key={result.id}
              variant={activeResult === result.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveResult(result.id)}
              className="flex items-center whitespace-nowrap"
            >
              <Clock className="h-3 w-3 mr-1" />
              {new Date(result.timestamp).toLocaleTimeString()}
              {result.response ? (
                <Badge
                  className={`ml-2 ${getStatusBadgeColor(
                    result.response.status
                  )}`}
                >
                  {result.response.status}
                </Badge>
              ) : (
                <Badge className="bg-destructive/10 text-destructive ml-2">Error</Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Main Content */}
        {activeTestResult ? (
          <div className="space-y-4">
            {/* Test Case Info */}
            {testCase && (
              <div className="bg-muted/40 border border-border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium flex items-center">
                    <Badge
                      className={cn(
                        "mr-2 px-2 py-1 text-xs",
                        testCase.request.method === "GET"
                          ? "bg-blue-100 text-blue-800"
                          : testCase.request.method === "POST"
                          ? "bg-success/10 text-success"
                          : testCase.request.method === "PUT"
                          ? "bg-yellow-100 text-yellow-800"
                          : testCase.request.method === "DELETE"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-gray-100 text-gray-800"
                      )}
                    >
                      {testCase.request.method}
                    </Badge>
                    {testCase.name}
                  </h3>
                  <Badge
                    className={getStatusBadgeColor(
                      activeTestResult.response?.status || 0
                    )}
                  >
                    {activeTestResult.response?.status || "Error"}
                  </Badge>
                </div>
                {testCase.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {testCase.description}
                  </p>
                )}
              </div>
            )}

            {/* Request/Response Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Request */}
              <div className="bg-muted/40 border border-border rounded-md p-4">
                <div className="font-semibold mb-2 flex items-center gap-2">
                  Request
                  <Badge className="bg-gray-100 text-gray-800">
                    {activeTestResult.request.method}
                  </Badge>
                </div>
                <div className="mb-2">
                  <span className="font-medium">URL:</span>
                  <div className="bg-muted p-2 rounded mt-1   break-all">
                    {activeTestResult.request.url}
                  </div>
                </div>
                <div className="mb-2">
                  <span className="font-medium">Headers:</span>
                  <div className="bg-muted p-2 rounded mt-1 max-h-24 overflow-y-auto  ">
                    {Object.keys(activeTestResult.request.headers).length >
                    0 ? (
                      <SyntaxHighlighter
                        language="json"
                        style={highlightStyle}
                        customStyle={{
                          background: "transparent",

                          margin: 0,
                          padding: 0,
                        }}
                      >
                        {JSON.stringify(
                          activeTestResult.request.headers,
                          null,
                          2
                        )}
                      </SyntaxHighlighter>
                    ) : (
                      <span className="text-muted-foreground">No headers</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Body:</span>
                  <div className="bg-muted p-2 rounded mt-1 max-h-32 overflow-y-auto ">
                    {activeTestResult.request.body ? (
                      <SyntaxHighlighter
                        language="json"
                        style={highlightStyle}
                        customStyle={{
                          background: "transparent",

                          margin: 0,
                          padding: 0,
                        }}
                      >
                        {typeof activeTestResult.request.body === "string"
                          ? activeTestResult.request.body
                          : JSON.stringify(
                              activeTestResult.request.body,
                              null,
                              2
                            )}
                      </SyntaxHighlighter>
                    ) : (
                      <span className="text-muted-foreground">No body</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Response */}
              <div className="bg-muted/40 border border-border rounded-md p-4 relative">
                <div className="font-semibold mb-2 flex items-center gap-2">
                  Response
                  {activeTestResult.response && (
                    <Badge
                      className={getStatusBadgeColor(
                        activeTestResult.response.status
                      )}
                    >
                      {activeTestResult.response.status}
                    </Badge>
                  )}
                </div>
                {activeTestResult.response ? (
                  <>
                    <div className="mb-2">
                      <span className="font-medium">Status:</span>
                      <span className="ml-2">
                        {activeTestResult.response.statusText}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Time:</span>
                      <span className="ml-2">
                        {activeTestResult.response.time}ms
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Headers:</span>
                      <div className="bg-muted p-2 rounded mt-1 max-h-24 overflow-y-auto ">
                        {Object.keys(activeTestResult.response.headers).length >
                        0 ? (
                          <SyntaxHighlighter
                            language="json"
                            style={highlightStyle}
                            customStyle={{
                              background: "transparent",

                              margin: 0,
                              padding: 0,
                            }}
                          >
                            {JSON.stringify(
                              activeTestResult.response.headers,
                              null,
                              2
                            )}
                          </SyntaxHighlighter>
                        ) : (
                          <span className="text-muted-foreground">
                            No headers
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mb-2">
                      <span className="font-medium">Body:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 opacity-50 hover:opacity-100"
                        onClick={() =>
                          copyToClipboard(
                            typeof activeTestResult.response?.body === "string"
                              ? activeTestResult.response.body
                              : JSON.stringify(
                                  activeTestResult.response?.body,
                                  null,
                                  2
                                )
                          )
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <div className="bg-muted p-2 rounded mt-1 max-h-32 overflow-y-auto  ">
                        {activeTestResult.response.body ? (
                          <SyntaxHighlighter
                            language="json"
                            style={highlightStyle}
                            customStyle={{
                              background: "transparent",

                              margin: 0,
                              padding: 0,
                            }}
                          >
                            {typeof activeTestResult.response.body === "string"
                              ? activeTestResult.response.body
                              : JSON.stringify(
                                  activeTestResult.response.body,
                                  null,
                                  2
                                )}
                          </SyntaxHighlighter>
                        ) : (
                          <span className="text-muted-foreground">No body</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-red-50 p-4 rounded-md mt-2">
                    <p className="text-red-800 font-medium">
                      No response (request failed)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Validation Results */}
            <div>
              <div className="font-semibold mb-2 flex items-center gap-2">
                Field Validations
                {activeTestResult.validations.length > 0 && (
                  <Badge
                    className={`ml-2 ${
                      activeTestResult.validations.some((v) => !v.valid)
                        ? "bg-destructive/10 text-destructive"
                        : "bg-success/10 text-success"
                    }`}
                  >
                    {
                      activeTestResult.validations.filter((v) => !v.valid)
                        .length
                    }{" "}
                    issues
                  </Badge>
                )}
              </div>
              {activeTestResult.validations.length > 0 ? (
                <div className="space-y-2">
                  {activeTestResult.validations.map((validation, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-md flex items-start ${
                        validation.valid
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <div className="mr-2 mt-0.5">
                        {validation.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{validation.field}</div>
                        <div className="text-xs">{validation.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No validation rules were applied to this request
                </p>
              )}
            </div>

            {/* Error Details */}
            {activeTestResult.error && (
              <div className="bg-red-50 border border-destructive/30 rounded-md p-3 text-red-800 mt-4">
                <p className="font-medium">Error Message:</p>
                <p className="mt-1">{activeTestResult.error}</p>
              </div>
            )}

            {/* Expected vs Actual */}
            {testCase?.expectedResponse && (
              <div className="mt-4">
                <div className="font-semibold mb-2 flex items-center gap-2">
                  Expected vs Actual
                  {testCase.expectedResponse.status !== undefined && (
                    <Badge
                      className={`ml-2 ${
                        testCase.expectedResponse.status ===
                        activeTestResult.response?.status
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      Status{" "}
                      {testCase.expectedResponse.status ===
                      activeTestResult.response?.status
                        ? "Match"
                        : "Mismatch"}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {testCase.expectedResponse.status !== undefined && (
                    <>
                      <div>
                        <div className="font-medium text-sm mb-1">
                          Expected Status:
                        </div>
                        <Badge>{testCase.expectedResponse.status}</Badge>
                      </div>
                      <div>
                        <div className="font-medium text-sm mb-1">
                          Actual Status:
                        </div>
                        <Badge
                          className={getStatusBadgeColor(
                            activeTestResult.response?.status || 0
                          )}
                        >
                          {activeTestResult.response?.status || "N/A"}
                        </Badge>
                      </div>
                    </>
                  )}
                  {testCase.expectedResponse.body && (
                    <>
                      <div>
                        <div className="font-medium text-sm mb-1">
                          Expected Body:
                        </div>
                        <div className="bg-muted p-2 rounded text-xs max-h-32 overflow-y-auto">
                          <SyntaxHighlighter
                            language="json"
                            style={highlightStyle}
                            customStyle={{
                              background: "transparent",
                              fontSize: "0.85em",
                              margin: 0,
                              padding: 0,
                            }}
                          >
                            {typeof testCase.expectedResponse.body === "string"
                              ? testCase.expectedResponse.body
                              : JSON.stringify(
                                  testCase.expectedResponse.body,
                                  null,
                                  2
                                )}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-sm mb-1">
                          Actual Body:
                        </div>
                        <div className="bg-muted p-2 rounded text-xs max-h-32 overflow-y-auto">
                          <SyntaxHighlighter
                            language="json"
                            style={highlightStyle}
                            customStyle={{
                              background: "transparent",
                              fontSize: "0.85em",
                              margin: 0,
                              padding: 0,
                            }}
                          >
                            {activeTestResult.response?.body
                              ? typeof activeTestResult.response.body ===
                                "string"
                                ? activeTestResult.response.body
                                : JSON.stringify(
                                    activeTestResult.response.body,
                                    null,
                                    2
                                  )
                              : "No response body"}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-md p-6 text-center">
            <div className="flex flex-col items-center justify-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <h3 className="text-lg font-medium">No tests run yet</h3>
              <p className="text-muted-foreground">
                Send a request to see test results and validation reports
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
