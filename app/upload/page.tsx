"use client";

import type React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/header";
import { saveData, fetchData } from "@/lib/data-service";
import { toast } from "sonner";
import { fetchApiSpecFromUrl } from "@/lib/fetch-document/document-service";
import {
  diffOpenApi,
  diffIsEmpty,
  bumpVersion,
} from "@/lib/openapi-diff";
import type { DiffSummary } from "@/lib/openapi-diff";
import { ChangeReviewDialog } from "@/components/change-review-dialog";
import { validateSpecId } from "@/lib/spec-id";

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetSpec = searchParams.get("spec") ?? "";

  const [apiSpec, setApiSpec] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [specName, setSpecName] = useState(presetSpec || "default");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingSpec, setPendingSpec] = useState<Record<string, unknown> | null>(
    null
  );
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [suggestedVersion, setSuggestedVersion] = useState("1.0.0");

  useEffect(() => {
    if (presetSpec) setSpecName(presetSpec);
  }, [presetSpec]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) readFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) readFile(e.target.files[0]);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setApiSpec(content);
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      if (fileName && !presetSpec) setSpecName(fileName);
    };
    reader.readAsText(file);
  };

  const fetchApiSpec = async () => {
    if (!apiUrl.trim()) {
      toast.error("Enter an API documentation URL");
      return;
    }
    setIsLoading(true);
    try {
      const { spec, name } = await fetchApiSpecFromUrl(apiUrl);
      setApiSpec(spec);
      if (name && !presetSpec) setSpecName(name);
      toast.success("API specification fetched");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const persistSpec = async (
    parsed: Record<string, unknown>,
    version: string,
    note: string,
    summary?: DiffSummary
  ) => {
    const info = (parsed.info as Record<string, unknown>) || {};
    parsed.info = { ...info, version };
    await saveData("spec", parsed, specName, { note, summary });
    toast.success("Specification saved");
    router.push(`/documentation/${specName}`);
  };

  const handleSubmit = async () => {
    if (!validateSpecId(specName)) {
      toast.error(
        "Invalid specification ID. Use letters, numbers, dots, hyphens, or underscores (e.g. api.example.com)."
      );
      return;
    }
    try {
      setIsSaving(true);
      const parsed = JSON.parse(apiSpec) as Record<string, unknown>;

      const existing = await fetchData("spec", specName);
      if (!existing) {
        const info = (parsed.info as Record<string, unknown>) || {};
        if (!info.version) {
          parsed.info = { ...info, version: "1.0.0" };
        }
        await saveData("spec", parsed, specName, {
          note: "Initial upload",
        });
        toast.success("Specification uploaded");
        router.push(`/documentation/${specName}`);
        return;
      }

      const summary = diffOpenApi(
        existing as Parameters<typeof diffOpenApi>[0],
        parsed as Parameters<typeof diffOpenApi>[1]
      );

      if (diffIsEmpty(summary)) {
        await persistSpec(parsed, (existing.info as { version?: string })?.version || "1.0.0", "No structural changes", summary);
        return;
      }

      const currentVer = (existing.info as { version?: string })?.version;
      const nextVer = bumpVersion(currentVer, summary.suggestedBump);
      setPendingSpec(parsed);
      setDiffSummary(summary);
      setSuggestedVersion(nextVer);
      setReviewOpen(true);
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error("Invalid JSON. Check your specification.");
      } else {
        toast.error("Failed to save specification");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReviewConfirm = async (version: string, note: string) => {
    if (!pendingSpec || !diffSummary) return;
    try {
      setIsSaving(true);
      await persistSpec(pendingSpec, version, note || "Version update", diffSummary);
      setReviewOpen(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Upload OpenAPI Specification"
        description="Upload or fetch your API specification"
        showBackButton
      />

      {diffSummary && (
        <ChangeReviewDialog
          key={suggestedVersion}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          summary={diffSummary}
          suggestedVersion={suggestedVersion}
          onConfirm={handleReviewConfirm}
          isSaving={isSaving}
        />
      )}

      <main className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="grid gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Fetch from API</CardTitle>
              <CardDescription>
                Pull OpenAPI JSON from your running service
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="spec-name">Specification ID</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Used as the spec key (e.g. my-api or api.example.com). Use the
                  same ID to upload updates.
                </p>
                <Input
                  id="spec-name"
                  value={specName}
                  onChange={(e) => setSpecName(e.target.value)}
                  placeholder="my-api"
                  disabled={!!presetSpec}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Label htmlFor="api-url">Documentation URL</Label>
                  <Input
                    id="api-url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="http://localhost:8080/v3/api-docs"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchApiSpec} disabled={isLoading}>
                    {isLoading ? "Fetching…" : "Fetch"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Upload file or paste JSON</CardTitle>
              <CardDescription>
                JSON required today; YAML accepted in the file picker for a
                future release
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center mb-6 transition-colors ${
                  isDragging
                    ? "border-primary/50 bg-primary/5"
                    : "border-border"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Drag and drop your OpenAPI file, or browse
                </p>
                <input
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="mt-4 inline-block">
                  <Button variant="outline" type="button" asChild>
                    <span>Browse files</span>
                  </Button>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="paste-spec">Or paste JSON</Label>
                  <Textarea
                    id="paste-spec"
                    value={apiSpec}
                    onChange={(e) => setApiSpec(e.target.value)}
                    placeholder='{ "openapi": "3.0.0", ... }'
                    className="font-mono h-64 mt-1"
                  />
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isSaving || !apiSpec.trim()}
                >
                  {isSaving ? "Processing…" : "Upload and process"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <UploadPageContent />
    </Suspense>
  );
}
