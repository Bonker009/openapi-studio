"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ListChecks,
  RefreshCw,
  Plus,
  X,
  Key,
  Code2,
  Info,
  Copy,
} from "lucide-react";
import { TestCaseGenerator } from "@/lib/test-case-generator";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useSyntaxHighlightStyle } from "@/hooks/use-syntax-highlight-style";
import { runTestCase as serverRunTestCase } from "@/components/runTestCase";

export default function TestCaseGeneratorPanel({
  requestSample,
  apiUrl,
  token,
  method,
  path,
}: {
  requestSample: any;
  apiUrl: string;
  token: string;
  method: string;
  path: string;
}) {
  console.log(
    "TestCaseGeneratorPanel mounted with requestSample:",
    method,
    path,
    requestSample
  );
  const [testCases, setTestCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [newKey, setNewKey] = useState("");
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"generate" | "run">("generate");
  const [results, setResults] = useState<Record<number, any>>({});
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const highlightStyle = useSyntaxHighlightStyle();

  // Load tokens from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("api_tester_auth_options");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object") {
            setTokens(parsed);
            const firstKey = Object.keys(parsed)[0] || "";
            setSelectedKey(firstKey);
          }
        } catch {
          // Do nothing: don't clear tokens, just ignore invalid storage
        }
      }
    }
  }, []);

  // Save tokens to localStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("api_tester_auth_options", JSON.stringify(tokens));
    }
  }, [tokens]);

  const handleGenerate = () => {
    setLoading(true);
    try {
      const cases = TestCaseGenerator.generateTestCases(requestSample);
      setTestCases(cases);
    } catch (e) {
      setTestCases([]);
    }
    setLoading(false);
  };

  const handleRunTestCase = async (testCase: any, idx: number) => {
    setRunningIndex(idx);
    const authToken =
      selectedKey && tokens[selectedKey] ? tokens[selectedKey] : token;
    try {
      const result = await serverRunTestCase(
        testCase,
        apiUrl + path,
        method,
        authToken
      );
      setResults((prev) => ({
        ...prev,
        [idx]: {
          status: result.status,
          ok: result.ok,
          response: result.response,
        },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [idx]: {
          status: "error",
          ok: false,
          response: String(error),
        },
      }));
    }
    setRunningIndex(null);
  };

  const tokenKeys = Object.keys(tokens);

  return (
    <div className="space-y-6 p-6 max-w-full gap-4 mx-auto">
      {/* Tab Switcher */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={activeTab === "generate" ? "default" : "outline"}
          onClick={() => setActiveTab("generate")}
          size="sm"
        >
          Generate Test Cases
        </Button>
        <Button
          variant={activeTab === "run" ? "default" : "outline"}
          onClick={() => setActiveTab("run")}
          size="sm"
          disabled={testCases.length === 0}
        >
          Run Test Cases
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === "generate" ? (
        <>
          {/* Generation Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Test Case Generation
              </CardTitle>
              <CardDescription>
                Generate test cases based on your request sample.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !requestSample}
                  className="flex-1"
                  size="lg"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ListChecks className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Generating..." : "Generate Test Cases"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTestCases([])}
                  disabled={loading || testCases.length === 0}
                  size="lg"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Results
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Cases Output */}
          {testCases.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Generated Test Cases</CardTitle>
                  <CardDescription>
                    {testCases.length} test case
                    {testCases.length !== 1 ? "s" : ""} generated successfully.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      JSON.stringify(testCases, null, 2)
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 w-full rounded-md border">
                  <div className="p-4">
                    <SyntaxHighlighter
                      language="json"
                      style={highlightStyle}
                      customStyle={{
                        margin: 0,
                        fontSize: "13px",
                        lineHeight: "1.4",
                        background: "transparent",
                      }}
                      wrapLongLines
                    >
                      {JSON.stringify(testCases, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Test Cases Generated
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Click &ldquo;Generate Test Cases&rdquo; to create comprehensive
                  test scenarios based on your request sample.
                </p>
                {!requestSample && (
                  <Alert className="max-w-md">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Please provide a request sample to generate test cases.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Run Test Cases</CardTitle>
            <CardDescription>
              Execute each test case and view the result below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full rounded-md border">
              <div className="p-4 space-y-4">
                {testCases.map((tc, idx) => (
                  <div key={tc.name} className="mb-4 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Badge>{tc.name}</Badge>
                      <Button
                        size="sm"
                        onClick={() => handleRunTestCase(tc, idx)}
                        disabled={runningIndex === idx}
                      >
                        {runningIndex === idx ? "Running..." : "Run"}
                      </Button>
                      {results[idx] && (
                        <span
                          className={
                            results[idx].ok
                              ? "text-success ml-2"
                              : "text-destructive ml-2"
                          }
                        >
                          {results[idx].status}
                        </span>
                      )}
                    </div>
                    {results[idx] && (
                      <pre className="bg-gray-100 rounded p-2 mt-2 text-xs overflow-x-auto">
                        {JSON.stringify(results[idx].response, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                {testCases.length === 0 && (
                  <div className="text-gray-400 text-sm">
                    No test cases to run. Generate some first.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
