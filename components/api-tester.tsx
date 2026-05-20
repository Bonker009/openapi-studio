"use client";
import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { ApiTesterProps, TestCase, TestResult } from "@/app/types/types";
import { FetchTester } from "@/lib/fetch-document/fetch-tester";

// UI components
import { Card, CardContent } from "@/components/ui/card";
import { AuthManager } from "./api-tester/auth-manager";
import { TestCaseManager } from "./api-tester/test-case-manager";
import { RequestBuilder } from "./api-tester/request-builder";
import { ResponseViewer } from "./api-tester/response-viewer";
import { TestReport } from "./api-tester/test-report";

export function ApiTester({
  path,
  method,
  apiData,
  requestSample,
  responseSample,
}: ApiTesterProps) {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [activeResult, setActiveResult] = useState<string | null>(null);
  const [requestBody, setRequestBody] = useState<string>(
    requestSample ? JSON.stringify(requestSample, null, 2) : ""
  );
  const [responseBody, setResponseBody] = useState<string>("");
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<
    Record<string, string>
  >({});
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({
    "Content-Type": "application/json",
  });

  const [authOptions, setAuthOptions] = useState<Record<string, string>>({});
  const [activeAuthOption, setActiveAuthOption] = useState<string | null>(null);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [bulkImportText, setBulkImportText] = useState<string>("");
  const [bulkImportError, setBulkImportError] = useState<string>("");
  const [bulkImportOpen, setBulkImportOpen] = useState<boolean>(false);
  const testResultIdSeq = useRef(0);

  const [baseUrl, setBaseUrl] = useState(
    apiData.servers && apiData.servers[0]?.url
      ? apiData.servers[0].url
      : "http://localhost:8080"
  );

  const form = useForm({
    defaultValues: {
      url: buildUrlWithPathParams(),
      headers: requestHeaders,
      method: method.toUpperCase(),
      body: requestBody,
    },
  });

  useEffect(() => {
    loadSavedData();
  }, []);

  function buildUrlWithPathParams(): string {
    const methodData = apiData.paths[path][method.toLowerCase()];
    const pathParams = methodData.parameters
      ? methodData.parameters.filter((p: any) => p.in === "path")
      : [];

    let urlPath = path;

    pathParams.forEach((param: any) => {
      let value = "example";
      if (param.schema?.format === "uuid") {
        value = "123e4567-e89b-12d3-a456-426614174000";
      } else if (param.schema?.type === "integer") {
        value = "1";
      }
      urlPath = urlPath.replace(`{${param.name}}`, value);
    });

    return `${baseUrl}${urlPath}`;
  }

  function loadSavedData() {
    const savedAuthOptions = localStorage.getItem("api_tester_auth_options");
    if (savedAuthOptions) {
      try {
        setAuthOptions(JSON.parse(savedAuthOptions));
      } catch (e) {
        console.error("Failed to parse saved auth options", e);
      }
    }

    const savedTestCases = localStorage.getItem("api_tester_test_cases");
    if (savedTestCases) {
      try {
        setTestCases(JSON.parse(savedTestCases));
      } catch (e) {
        console.error("Failed to parse saved test cases", e);
      }
    }
  }

  const executeRequest = async () => {
    const formData = form.getValues();
    const url = formData.url;
    console.log("Executing request to URL:", url);
    console.log("This is form request body:", formData);
    setLoading(true);
    setResponseBody("");
    setResponseStatus(null);
    setResponseTime(null);
    setResponseHeaders({});

    try {
      // Build request options
      const requestOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: requestHeaders,
      };

      if (method.toUpperCase() !== "GET" && formData) {
        requestOptions.body = formData.body;
        console.log("Request body in here:", requestBody);
      }
      // your are here
      console.log("Here here", url, requestOptions);
      const response = await FetchTester(url, requestOptions);
      console.log("Response received:", response);
      if (response.data != null) {
        const formattedData =
          typeof response.data === "object"
            ? JSON.stringify(response.data, null, 2)
            : String(response.data);

        setResponseBody(formattedData);
      }

      setResponseStatus(response.status);
      setResponseTime(response.responseTime);
      setResponseHeaders(response.headers);

      const testResult: TestResult = {
        id: `tr-${++testResultIdSeq.current}`,
        timestamp: new Date(),
        request: {
          url,
          method: method.toUpperCase(),
          headers: requestHeaders,
          body: requestBody
            ? (function () {
                try {
                  return JSON.parse(requestBody);
                } catch (e) {
                  return requestBody;
                }
              })()
            : undefined,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.data,
          time: response.responseTime,
        },
        validations: validateResponse(response.data),
      };

      setTestResults((prev) => [testResult, ...prev].slice(0, 10));
      setActiveResult(testResult.id);

      return testResult;
    } catch (error) {
      console.error("Request failed:", error);

      const testResult: TestResult = {
        id: `tr-${++testResultIdSeq.current}`,
        timestamp: new Date(),
        request: {
          url,
          method: method.toUpperCase(),
          headers: requestHeaders,
          body: requestBody
            ? (function () {
                try {
                  return JSON.parse(requestBody);
                } catch (e) {
                  return requestBody;
                }
              })()
            : undefined,
        },
        response: null,
        validations: [],
        error: error instanceof Error ? error.message : String(error),
      };

      setTestResults((prev) => [testResult, ...prev].slice(0, 10));
      setActiveResult(testResult.id);
      return testResult;
    } finally {
      setLoading(false);
    }
  };

  function validateResponse(
    responseData: any
  ): { field: string; valid: boolean; message: string }[] {
    const validations: { field: string; valid: boolean; message: string }[] =
      [];

    const methodData = apiData.paths[path][method.toLowerCase()];
    const successResponse = methodData.responses && methodData.responses["200"];
    const schema = successResponse?.content?.["application/json"]?.schema;

    if (!schema || !responseData) {
      return validations;
    }

    Object.keys(responseData).forEach((field) => {
      validations.push(validateField(field, responseData[field], schema));
    });

    return validations;
  }

  function validateField(
    field: string,
    value: any,
    schema: any
  ): { field: string; valid: boolean; message: string } {
    if (!schema) {
      return { field, valid: true, message: "No validation schema" };
    }

    if (
      schema.required &&
      schema.required.includes(field) &&
      (value === undefined || value === null || value === "")
    ) {
      return {
        field,
        valid: false,
        message: `${field} is required`,
      };
    }

    return { field, valid: true, message: "Validation passed" };
  }

  const sharedProps = {
    getStatusBadgeColor: (status: number | null) => {
      if (!status) return "bg-gray-100 text-gray-800";
      if (status >= 200 && status < 300) return "bg-green-100 text-green-800";
      if (status >= 400 && status < 500) return "bg-red-100 text-red-800";
      if (status >= 500) return "bg-orange-100 text-orange-800";
      return "bg-blue-100 text-blue-800";
    },

    copyToClipboard: (text: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => console.log("Copied to clipboard"))
        .catch((err) => console.error("Failed to copy:", err));
    },
  };
  console.log("Response body:", responseBody);
  console.log("Response status:", responseStatus);
  console.log("Response time:", responseTime);
  console.log("Response headers:", responseHeaders);
  console.log("Test case results:", testResults);
  console.log("Active test result:", activeResult);
  console.log("Testcases:", testCases);

  // Extract parameters from apiData
  const parameters = apiData.paths[path][method.toLowerCase()].parameters || [];

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AuthManager
          authOptions={authOptions}
          activeAuthOption={activeAuthOption}
          setActiveAuthOption={setActiveAuthOption}
          requestHeaders={requestHeaders}
          setRequestHeaders={setRequestHeaders}
          saveAuthOptions={(options) => {
            setAuthOptions(options);
            localStorage.setItem(
              "api_tester_auth_options",
              JSON.stringify(options)
            );
          }}
        />

        {/* Test Case Manager */}
        <TestCaseManager
          testCases={testCases}
          setTestCases={setTestCases}
          form={form}
          requestHeaders={requestHeaders}
          requestBody={requestBody}
          method={method}
          bulkImportText={bulkImportText}
          setBulkImportText={setBulkImportText}
          bulkImportError={bulkImportError}
          setBulkImportError={setBulkImportError}
          bulkImportOpen={bulkImportOpen}
          setBulkImportOpen={setBulkImportOpen}
          executeRequest={async () => {
            await executeRequest();
          }}
          loading={loading}
          setTestResults={setTestResults}
          setActiveResult={setActiveResult}
          // Add these two props explicitly
          setRequestBody={setRequestBody}
          setRequestHeaders={setRequestHeaders}
          saveTestCases={(cases) => {
            setTestCases(cases);
            localStorage.setItem(
              "api_tester_test_cases",
              JSON.stringify(cases)
            );
          }}
          {...sharedProps}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Request Builder */}
        <RequestBuilder
          form={form}
          requestBody={requestBody}
          setRequestBody={setRequestBody}
          requestHeaders={requestHeaders}
          setRequestHeaders={setRequestHeaders}
          executeRequest={async () => {
            await executeRequest();
          }}
          loading={loading}
          parameters={parameters}
          method={method}
          path={path}
          apiData={apiData}
          activeAuthOption={activeAuthOption}
          {...sharedProps}
        />
        {/* Response Viewer */}
        <ResponseViewer
          responseBody={responseBody}
          responseStatus={responseStatus}
          responseTime={responseTime}
          responseHeaders={responseHeaders}
          {...sharedProps}
        />
      </div>

      {/* Test Report */}
      <TestReport
        testResults={testResults}
        activeResult={activeResult}
        setActiveResult={setActiveResult}
        testCases={testCases}
        {...sharedProps}
      />
    </div>
  );
}
