"use client";

import type React from "react";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { XCircle, ListChecks, Plus, FileDown, PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BulkImportDialog } from "./bulk-import-dialog";
import type { TestCase, TestResult } from "@/app/types/types";
import type { UseFormReturn } from "react-hook-form";

// Updated props interface
export interface TestCaseManagerProps {
  testCases: TestCase[];
  setTestCases: React.Dispatch<React.SetStateAction<TestCase[]>>;
  form: UseFormReturn<any>;
  requestHeaders: Record<string, string>;
  requestBody: string;
  method: string;
  executeRequest: () => Promise<void>;
  loading: boolean;
  setTestResults: React.Dispatch<React.SetStateAction<TestResult[]>>;
  setActiveResult: React.Dispatch<React.SetStateAction<string | null>>;
  saveTestCases: (testCases: TestCase[]) => void;
  bulkImportText: string;
  setBulkImportText: React.Dispatch<React.SetStateAction<string>>;
  bulkImportError: string;
  setBulkImportError: React.Dispatch<React.SetStateAction<string>>;
  bulkImportOpen: boolean;
  setBulkImportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  getStatusBadgeColor: (status: number) => string;
  // Add these props for updating request body and headers
  setRequestBody: React.Dispatch<React.SetStateAction<string>>;
  setRequestHeaders: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

export function TestCaseManager({
  testCases,
  setTestCases,
  form,
  requestHeaders,
  requestBody,
  method,
  executeRequest,
  loading,
  setTestResults,
  setActiveResult,
  saveTestCases,
  bulkImportOpen,
  setBulkImportOpen,
  bulkImportText,
  setBulkImportText,
  bulkImportError,
  setBulkImportError,
  getStatusBadgeColor,
  setRequestBody,
  setRequestHeaders,
}: TestCaseManagerProps) {
  const [showTestCaseForm, setShowTestCaseForm] = useState(false);
  const [newTestCaseName, setNewTestCaseName] = useState("");
  const [newTestCaseDescription, setNewTestCaseDescription] = useState("");
  console.log("TestCaseManager render : ", testCases);
  const groupTestCasesByTitle = (
    testCases: TestCase[]
  ): Record<string, TestCase[]> => {
    const grouped: Record<string, TestCase[]> = {};

    testCases.forEach((testCase) => {
      // Extract title from name (everything before the first dash)
      const titleMatch = testCase.name.match(/^([^-]+)(-|$)/);
      const title = titleMatch ? titleMatch[1].trim() : "General";

      if (!grouped[title]) {
        grouped[title] = [];
      }

      grouped[title].push(testCase);
    });

    return grouped;
  };

  const saveCurrentAsTestCase = () => {
    if (!newTestCaseName.trim()) return;

    let body;
    try {
      body = requestBody ? JSON.parse(requestBody) : undefined;
    } catch (e) {
      // If parsing fails, use the raw string
      body = requestBody;
    }

    // Get the current form data
    const formData = form.getValues();

    // Create the new test case
    const newTestCase: TestCase = {
      id: `test-${Date.now()}`,
      name: newTestCaseName,
      description: newTestCaseDescription,
      request: {
        url: formData.url,
        method: method.toUpperCase(),
        headers: { ...requestHeaders },
        body,
      },
    };

    // Add the test case to the list
    const updatedTestCases = [...testCases, newTestCase];
    saveTestCases(updatedTestCases);

    // Reset form
    setNewTestCaseName("");
    setNewTestCaseDescription("");
    setShowTestCaseForm(false);
  };

  const deleteTestCase = (id: string) => {
    const updatedTestCases = testCases.filter((tc) => tc.id !== id);
    saveTestCases(updatedTestCases);
  };

  const runTestCase = async (testCase: TestCase, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      // Set URL and method
      form.setValue("url", testCase.request.url);

      // Set headers
      setRequestHeaders({ ...testCase.request.headers });

      // Set body if present
      if (testCase.request.body) {
        const bodyString =
          typeof testCase.request.body === "string"
            ? testCase.request.body
            : JSON.stringify(testCase.request.body, null, 2);

        setRequestBody(bodyString);
        form.setValue("body", bodyString);
      }

      // Wait for state updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Execute request
      await executeRequest();

      // Update test case with last run timestamp
      const updatedTestCases = testCases.map((tc) =>
        tc.id === testCase.id
          ? { ...tc, lastRun: new Date().toISOString() }
          : tc
      );

      saveTestCases(updatedTestCases);
      // setActiveResult(result.id); // Remove or update this line if result is needed
    } catch (error) {
      console.error("Error running test case:", error);
    }
  };

  const runAllTestCases = async () => {
    if (loading || testCases.length === 0) return;

    setTestResults([]);

    // Run test cases sequentially
    for (const testCase of testCases) {
      try {
        await runTestCase(testCase);
        console.log(`Test case ${testCase.id} executed successfully`);
        // Add slight delay between test cases
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error running test case ${testCase.id}:`, error);
      }
    }
  };

  const handleBulkImport = () => {
    try {
      setBulkImportError("");
      const importedCases = JSON.parse(bulkImportText);

      if (!Array.isArray(importedCases)) {
        setBulkImportError("The imported data must be an array of test cases");
        return;
      }

      const formData = form.getValues();
      const url = formData.url;

      // Get the current request body to use as base template
      let baseBody = {};
      try {
        if (requestBody) {
          baseBody = JSON.parse(requestBody);
        }
      } catch (e) {
        setBulkImportError("Current request body is not valid JSON");
        return;
      }

      const validCases: TestCase[] = [];

      importedCases.forEach((testCase: any, index: number) => {
        if (testCase.name) {
          const mergedBody = { ...baseBody };

          if (testCase.fields) {
            Object.assign(mergedBody, testCase.fields);
          }

          const newCase: TestCase = {
            id: `test-${Date.now()}-${index}`,
            name: testCase.name,
            description: testCase.description || "",
            request: {
              url: url,
              method: method.toUpperCase(),
              headers: { ...requestHeaders },
              body: mergedBody,
            },

            expectedResponse: testCase.expectedResponse,
          };
          validCases.push(newCase);
        }
      });

      if (validCases.length === 0) {
        setBulkImportError("No valid test cases found in the import data");
        return;
      }

      // Add all valid test cases
      const updatedTestCases = [...testCases, ...validCases];
      saveTestCases(updatedTestCases);

      setBulkImportText("");
      setBulkImportOpen(false);
    } catch (e) {
      setBulkImportError("Invalid JSON format");
    }
  };

  const exportTestCases = () => {
    const testCasesJson = JSON.stringify(testCases, null, 2);
    const blob = new Blob([testCasesJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `api_test_cases_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <ListChecks className="h-4 w-4 mr-2" />
          Test Cases
        </CardTitle>
        <CardDescription>Save and manage API test scenarios</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex justify-end gap-2">
          <BulkImportDialog
            requestBody={requestBody}
            open={bulkImportOpen}
            setOpen={setBulkImportOpen}
            bulkImportText={bulkImportText}
            setBulkImportText={setBulkImportText}
            bulkImportError={bulkImportError}
            setBulkImportError={setBulkImportError}
            handleBulkImport={handleBulkImport}
          />

          <Button
            size="sm"
            variant="outline"
            onClick={exportTestCases}
            disabled={testCases.length === 0}
            className="flex items-center"
          >
            <FileDown className="h-3 w-3 mr-1" />
            Export
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={testCases.length === 0 || loading}
            onClick={runAllTestCases}
            className="flex items-center"
          >
            <PlayIcon className="h-3 w-3 mr-1" />
            Run All
          </Button>
        </div>

        {testCases.length > 0 ? (
          <ScrollArea className="h-[300px] border rounded-md">
            <div className="space-y-4 p-4">
              {Object.entries(groupTestCasesByTitle(testCases)).map(
                ([title, cases]) => (
                  <div key={title} className="space-y-1">
                    <div className="font-medium text-sm bg-slate-200 p-1 px-2 rounded-md">
                      {title} <Badge variant="outline">{cases.length}</Badge>
                    </div>

                    <div className="space-y-2 pl-2">
                      {cases.map((testCase) => (
                        <div
                          key={testCase.id}
                          className="flex items-center justify-between p-2 bg-slate-100 hover:bg-slate-200 transition-colors rounded-md"
                        >
                          <div className="flex-1">
                            <div className="font-medium flex items-center">
                              <Badge
                                className={cn(
                                  "mr-2 px-2 py-1 text-xs",
                                  testCase.request.method === "GET"
                                    ? "bg-blue-100 text-blue-800"
                                    : testCase.request.method === "POST"
                                    ? "bg-green-100 text-green-800"
                                    : testCase.request.method === "PUT"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : testCase.request.method === "DELETE"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                )}
                              >
                                {testCase.request.method}
                              </Badge>

                              {testCase.name.replace(
                                new RegExp(`^${title}\\s*-\\s*`),
                                ""
                              )}
                            </div>
                            {testCase.description && (
                              <div className="text-xs text-muted-foreground">
                                {testCase.description}
                              </div>
                            )}
                            <div className="text-xs mt-1 truncate">
                              {testCase.request.url}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {testCase.result && (
                              <Badge
                                className={getStatusBadgeColor(
                                  testCase.result.response?.status || 0
                                )}
                              >
                                {testCase.result.response?.status || "Error"}
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => runTestCase(testCase, e)}
                              disabled={loading}
                            >
                              Run
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTestCase(testCase.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="border rounded-md p-8 text-center bg-slate-50">
            <p className="text-muted-foreground">No saved test cases</p>
            <p className="text-sm text-muted-foreground mt-1">
              Save your current request as a test case to get started
            </p>
          </div>
        )}

        <Card className="border-dashed mt-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Save Current Request as Test Case
            </CardTitle>
          </CardHeader>

          <CardContent>
            {showTestCaseForm ? (
              <div className="space-y-3">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="test-case-name">Test Case Name</Label>
                  <Input
                    id="test-case-name"
                    placeholder="Group Title - Test Case Name (e.g. Auth - Login Success)"
                    value={newTestCaseName}
                    onChange={(e) => setNewTestCaseName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Prefix with &quot;Group Title -&quot; to organize test cases into
                    groups
                  </p>
                </div>

                <div className="flex flex-col space-y-1">
                  <Label htmlFor="test-case-description">
                    Description (optional)
                  </Label>
                  <Textarea
                    id="test-case-description"
                    placeholder="Description (optional)"
                    value={newTestCaseDescription}
                    onChange={(e) => setNewTestCaseDescription(e.target.value)}
                    className="h-20"
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={saveCurrentAsTestCase}
                    disabled={!newTestCaseName.trim()}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowTestCaseForm(false);
                      setNewTestCaseName("");
                      setNewTestCaseDescription("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowTestCaseForm(true)}
                className="flex items-center bg-red-400 hover:bg-red-500"
              >
                <Plus className="h-3 w-3 mr-1" />
                Save Current Request
              </Button>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
