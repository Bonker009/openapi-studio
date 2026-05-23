import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Import, Copy, FileJson, Brain } from "lucide-react";
import { BulkImportDialogProps } from "@/app/types/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type ExtendedBulkImportDialogProps = BulkImportDialogProps & {
  setBulkImportError: (error: string) => void;
};

export function BulkImportDialog({
  open,
  setOpen,
  bulkImportText,
  setBulkImportText,
  bulkImportError,
  setBulkImportError,
  handleBulkImport,
  requestBody,
}: ExtendedBulkImportDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const sample = (() => {
    try {
      const sampleData = [
        {
          name: "Register - Valid User",
          description: "Register with valid data",
          fields: JSON.parse(requestBody),
        },
        {
          name: "Register - Empty Fields",
          description: "Test with empty fields",
          fields: JSON.parse(requestBody),
        },
      ];
      return JSON.stringify(sampleData, null, 2);
    } catch {
      return ` [
  {
    "name": "Register - Valid User",
    "description": "Register with valid data",
    "fields": ${requestBody}
  },
  {
    "name": "Register - Empty Fields",
    "description": "Test with empty fields",
    "fields": ${requestBody}
  }
]`;
    }
  })();

  const handleCopySample = () => {
    navigator.clipboard.writeText(sample);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(bulkImportText);
      setBulkImportText(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // If invalid JSON, don't format
      console.error("Invalid JSON");
    }
  };

  // Add generateWithLlama function
  const generateWithLlama = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch("/api/llama-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestBody,
          history: bulkImportText ? [bulkImportText] : [], // Pass current text as history
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate test cases");
      }

      const data = await response.json();

      // Format the generated test cases
      const formattedCases = JSON.stringify(data.testCases, null, 2);
      setBulkImportText(formattedCases);
    } catch (error) {
      console.error("Error generating test cases:", error);
      setBulkImportError("Failed to generate test cases with AI");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Import className="h-4 w-4 mr-1" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Import Test Cases</DialogTitle>
          <DialogDescription>
            Paste JSON array of test cases to import them in bulk
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Tabs defaultValue="input" className="w-full">
            <TabsList className="mb-2">
              <TabsTrigger value="input">Your Input</TabsTrigger>
              <TabsTrigger value="sample">Sample</TabsTrigger>
            </TabsList>
            <TabsContent value="input">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="bulk-import">Test Cases JSON</Label>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateWithLlama}
                      className="h-8"
                      disabled={isGenerating}
                    >
                      <Brain className="h-4 w-4 mr-1" />
                      {isGenerating ? "Generating..." : "Generate with AI"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFormatJson}
                      className="h-8"
                    >
                      <FileJson className="h-4 w-4 mr-1" />
                      Format JSON
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Textarea
                    id="bulk-import"
                    className="font-mono text-sm h-[400px] pr-10"
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    placeholder="Paste your JSON here..."
                  />
                  {bulkImportText && (
                    <div className="absolute top-2 right-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigator.clipboard.writeText(bulkImportText)
                        }
                        className="h-8 px-2"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {bulkImportError && (
                  <p className="text-destructive text-sm flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {bulkImportError}
                  </p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="sample">
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <Label>Sample JSON</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopySample}
                    className="h-8"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-muted/40 rounded-md">
                  <SyntaxHighlighter
                    language="json"
                    style={oneLight}
                    customStyle={{
                      margin: 0,
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    {sample}
                  </SyntaxHighlighter>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="bg-warning/10 border border-warning/30 p-2 rounded-md">
            <p className="text-warning text-xs">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              Test cases will use the current request setup (URL, method,
              headers)
            </p>
            <p className="text-warning text-xs mt-1">
              Add a &quot;fields&quot; object to specify request body fields for each
              test case
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleBulkImport}>Import Test Cases</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
