"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  XCircle,
  Upload,
  File,
  X,
  Plus,
  Copy,
  Eye,
  EyeOff,
  FileText,
  ImageIcon,
  Video,
  Music,
  FileJson,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseFormReturn } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RequestBuilderProps {
  method: string;
  apiData: any;
  path: string;
  requestSample?: any;
  form: UseFormReturn<any>;
  loading: boolean;
  requestBody: string;
  requestHeaders: Record<string, string>;
  activeAuthOption: string | null;
  setRequestBody: React.Dispatch<React.SetStateAction<string>>;
  setRequestHeaders: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  executeRequest: () => Promise<void>;
  parameters?: {
    name: string;
    in: "path" | "query";
    required?: boolean;
    description?: string;
    schema?: {
      type: string;
      enum?: string[];
    };
  }[];
}

interface UploadedFile {
  file: File;
  id: string;
  preview?: string;
}

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (type.startsWith("video/")) return <Video className="h-4 w-4" />;
  if (type.startsWith("audio/")) return <Music className="h-4 w-4" />;
  if (type.includes("text/") || type.includes("json"))
    return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  );
};

export function RequestBuilder({
  method,
  apiData,
  path,
  requestSample,
  form,
  loading,
  requestBody,
  requestHeaders,
  activeAuthOption,
  setRequestBody,
  setRequestHeaders,
  executeRequest,
  parameters,
}: RequestBuilderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bodyType, setBodyType] = useState<"json" | "form-data" | "raw">(
    "json"
  );
  const [formFields, setFormFields] = useState<
    Array<{ key: string; value: string; type: "text" | "file" }>
  >([]);
  const [showRawBody, setShowRawBody] = useState(false);

  // Determine if the request is multipart/form-data
  const isMultipart =
    bodyType === "form-data" ||
    requestHeaders["Content-Type"] === "multipart/form-data" ||
    requestHeaders["content-type"] === "multipart/form-data";

  // Header management
  const handleAddHeader = () => {
    setRequestHeaders((prev) => ({
      ...prev,
      "": "",
    }));
  };

  const handleRemoveHeader = (key: string) => {
    setRequestHeaders((prev) => {
      const newHeaders = { ...prev };
      delete newHeaders[key];
      return newHeaders;
    });
  };

  const handleHeaderChange = (
    oldKey: string,
    newKey: string,
    newValue: string
  ) => {
    setRequestHeaders((prev) => {
      const newHeaders: Record<string, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (k !== oldKey) {
          newHeaders[k] = v;
        }
      });
      if (newKey.trim()) {
        newHeaders[newKey] = newValue;
      }
      return newHeaders;
    });
  };

  // File upload handlers
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // Form field management
  const addFormField = () => {
    setFormFields((prev) => [...prev, { key: "", value: "", type: "text" }]);
  };

  const removeFormField = (index: number) => {
    setFormFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFormField = (
    index: number,
    field: Partial<(typeof formFields)[0]>
  ) => {
    setFormFields((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...field } : item))
    );
  };

  // Update content type based on body type
  useEffect(() => {
    if (bodyType === "form-data") {
      setRequestHeaders((prev) => ({
        ...prev,
        "Content-Type": "multipart/form-data",
      }));
    } else if (bodyType === "json") {
      setRequestHeaders((prev) => ({
        ...prev,
        "Content-Type": "application/json",
      }));
    }
  }, [bodyType, setRequestHeaders]);

  const commonHeaders = [
    "Content-Type",
    "Authorization",
    "Accept",
    "User-Agent",
    "X-API-Key",
    "Cache-Control",
  ];

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(requestBody);
      const pretty = JSON.stringify(parsed, null, 2);
      setRequestBody(pretty);
      form.setValue("body", pretty);
    } catch {
      // Optionally show an error or ignore if invalid JSON
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Send className="h-4 w-4 mr-2" />
          Request Builder
        </CardTitle>
        <CardDescription>Configure and send your API request</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-4">
              {/* URL and Method */}
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-bold min-w-[60px] justify-center",
                    method === "GET"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : method === "POST"
                      ? "bg-success/10 text-success border-success/30"
                      : method === "PUT"
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                      : method === "DELETE"
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                  )}
                  variant="outline"
                >
                  {method.toUpperCase()}
                </Badge>
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="https://api.example.com/endpoint"
                          {...field}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Tabs defaultValue="headers" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="body">Body</TabsTrigger>
                  <TabsTrigger value="params">Parameters</TabsTrigger>
                </TabsList>

                <TabsContent value="headers" className="space-y-4">
                  <div className="space-y-3">
                    {Object.entries(requestHeaders).map(
                      ([key, value], index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50/50"
                        >
                          <div className="flex-1">
                            <Select
                              value={key}
                              onValueChange={(newKey) =>
                                handleHeaderChange(key, newKey, value)
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Header name" />
                              </SelectTrigger>
                              <SelectContent>
                                {commonHeaders.map((header) => (
                                  <SelectItem key={header} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Input
                              placeholder="Value"
                              value={value}
                              onChange={(e) =>
                                handleHeaderChange(key, key, e.target.value)
                              }
                              className="bg-white"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveHeader(key)}
                            className="px-2 text-destructive hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddHeader}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Header
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="body" className="space-y-4">
                  {/* Body Type Selection */}
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Body Type:</Label>
                    <Select
                      value={bodyType}
                      onValueChange={(value: any) => setBodyType(value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="form-data">Form Data</SelectItem>
                        <SelectItem value="raw">Raw</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {bodyType === "form-data" ? (
                    <div className="space-y-4">
                      {/* Form Fields */}
                      <div className="space-y-3">
                        {formFields.map((field, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50/50"
                          >
                            <Input
                              placeholder="Key"
                              value={field.key}
                              onChange={(e) =>
                                updateFormField(index, { key: e.target.value })
                              }
                              className="flex-1 bg-white"
                            />
                            <Select
                              value={field.type}
                              onValueChange={(type: "text" | "file") =>
                                updateFormField(index, { type })
                              }
                            >
                              <SelectTrigger className="w-20 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="file">File</SelectItem>
                              </SelectContent>
                            </Select>
                            {field.type === "text" ? (
                              <Input
                                placeholder="Value"
                                value={field.value}
                                onChange={(e) =>
                                  updateFormField(index, {
                                    value: e.target.value,
                                  })
                                }
                                className="flex-1 bg-white"
                              />
                            ) : (
                              <div className="flex-1 text-sm text-gray-500 bg-white border rounded px-3 py-2">
                                Select files below
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFormField(index)}
                              className="px-2 text-destructive hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addFormField}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Field
                        </Button>
                      </div>

                      <Separator />

                      {/* File Upload Area */}
                      <div className="space-y-4">
                        <Label className="text-sm font-medium">
                          File Uploads
                        </Label>
                        <div
                          className="border-2 border-dashed rounded-lg p-2 text-center transition-colors border-gray-300 hover:border-gray-400 "
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                        >
                          <p className="text-sm text-gray-600 mb-2 flex flex-col items-center">
                            Drag and drop files here, or{" "}
                            <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                              browse
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) =>
                                  handleFileUpload(e.target.files)
                                }
                              />
                            </label>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          Request Body
                        </Label>
                        <div className="flex items-center gap-2">
                          {requestSample && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const sampleBody = JSON.stringify(
                                  requestSample,
                                  null,
                                  2
                                );
                                setRequestBody(sampleBody);
                                form.setValue("body", sampleBody);
                              }}
                              type="button"
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Use Sample
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="bg-green-300 hover:bg-success transform-fill duration-500"
                            size="sm"
                            onClick={handleFormatJson}
                            type="button"
                          >
                            <FileJson className="h-4 w-4 mr-1" />
                            Format JSON
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRawBody(!showRawBody)}
                            type="button"
                          >
                            {showRawBody ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <FormField
                        control={form.control}
                        name="body"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder={
                                  bodyType === "json"
                                    ? '{\n  "key": "value"\n}'
                                    : "Raw request body content"
                                }
                                className="font-mono text-sm h-[200px] resize-none"
                                value={requestBody}
                                onChange={(e) => {
                                  setRequestBody(e.target.value);
                                  field.onChange(e);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="params" className="space-y-4">
                  {!parameters || parameters.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="text-sm text-gray-500 space-y-2">
                        <p>No parameters defined for this endpoint.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4">
                      {parameters.map((param, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">
                              {param.name}
                              {param.required && <span className="text-destructive">*</span>}
                            </Label>
                            <Badge variant="outline">{param.in}</Badge>
                            {param.description && (
                              <span className="text-xs text-gray-500">
                                {param.description}
                              </span>
                            )}
                          </div>
                          <Input
                            placeholder={`Enter ${param.name}`}
                            onChange={(e) => {
                              const url = new URL(form.getValues("url"));
                              if (param.in === "query") {
                                if (e.target.value) {
                                  url.searchParams.set(param.name, e.target.value);
                                } else {
                                  url.searchParams.delete(param.name);
                                }
                                form.setValue("url", url.toString());
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {activeAuthOption && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-800 border-blue-200"
            >
              🔐 {activeAuthOption}
            </Badge>
          )}
          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Uploaded Files ({uploadedFiles.length})
              </Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {uploadedFiles.map((uploadedFile) => (
                  <div
                    key={uploadedFile.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-white"
                  >
                    <div className="flex-shrink-0">
                      {uploadedFile.preview ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 rounded overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all">
                              <img
                                src={uploadedFile.preview || "/placeholder.svg"}
                                alt={uploadedFile.file.name}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-80">
                            <div className="p-2">
                              <img
                                src={uploadedFile.preview || "/placeholder.svg"}
                                alt={uploadedFile.file.name}
                                className="w-full h-auto max-h-64 object-contain rounded"
                              />
                              <div className="mt-2 text-sm text-gray-600">
                                <p className="font-medium truncate">
                                  {uploadedFile.file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(uploadedFile.file.size)} •{" "}
                                  {uploadedFile.file.type}
                                </p>
                              </div>
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center">
                          {getFileIcon(uploadedFile.file.type)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(uploadedFile.file.size)} •{" "}
                        {uploadedFile.file.type || "Unknown type"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadedFile.id)}
                      className="px-2 text-destructive hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={executeRequest}
          disabled={loading}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white"
          type="button"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Request
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
