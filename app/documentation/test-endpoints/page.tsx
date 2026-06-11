"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { runTestCase } from "@/components/runTestCase";
import { Header } from "@/components/header";

export default function ApiAutoTestPage() {
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [testCasesJson, setTestCasesJson] = useState("");
  const [testCases, setTestCases] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleParseTestCases = () => {
    try {
      const parsed = JSON.parse(testCasesJson);
      setTestCases(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      alert("Invalid JSON for test cases.");
    }
  };

  const handleRunAll = async () => {
    setLoading(true);
    setResults([]);
    const res: any[] = [];
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const result = await runTestCase(tc, apiUrl);
      res.push(result);
    }
    setResults(res);
    setLoading(false);
  };

  return (
    <>
      <Header
        title="API Auto Tester"
        description="Run automated tests for your API endpoints"
        showBackButton={true}
        showHomeButton={true}
      />
      <div className="max-w-2xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>API Auto Tester</CardTitle>
            <CardDescription>
              Enter your API endpoint, token, and test cases to run automated
              tests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">API URL</label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Bearer Token (optional)
              </label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your token here"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Test Cases (JSON array)
              </label>
              <Textarea
                rows={6}
                value={testCasesJson}
                onChange={(e) => setTestCasesJson(e.target.value)}
                placeholder={`[
                {
                  "name": "Valid request",
                  "description": "Should return 200",
                  "body": { "foo": "bar" },
                  "expectedStatus": 200
                }
              ]`}
              />
              <Button size="sm" className="mt-2" onClick={handleParseTestCases}>
                Parse Test Cases
              </Button>
            </div>
            <Button
              onClick={handleRunAll}
              disabled={loading || !apiUrl || testCases.length === 0}
              className="w-full"
            >
              {loading ? "Running..." : "Run All Test Cases"}
            </Button>
            {results.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="font-semibold text-lg">Results</h3>
                {results.map((res, idx) => (
                  <div key={idx} className="border rounded p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>
                        {testCases[idx]?.name || `Test #${idx + 1}`}
                      </Badge>
                      <span
                        className={res.ok ? "text-success" : "text-destructive"}
                      >
                        {res.status}
                      </span>
                    </div>
                    <pre className="bg-white rounded p-2 text-xs overflow-x-auto">
                      {JSON.stringify(res.response, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
