"use client";

import { Download, FileJson, FileSpreadsheet, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadExcelWorkbook, slugifyFileName } from "@/lib/export-excel";
import { buildEndpointWorkbookSheets } from "@/lib/export/build-endpoint-workbook";
import {
  downloadOpenApiJson,
  downloadPostmanCollection,
  openApiToPostmanCollection,
} from "@/lib/export/export-postman";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { toast } from "sonner";

type ExportMenuProps = {
  specTitle: string;
  specId: string;
  baseUrl: string;
  endpoints: PlaygroundEndpoint[];
  apiData: Record<string, unknown>;
};

export function ExportMenu({
  specTitle,
  specId,
  baseUrl,
  endpoints,
  apiData,
}: ExportMenuProps) {
  const date = new Date().toISOString().slice(0, 10);
  const baseName = slugifyFileName(specTitle || specId);

  const handleExcel = async () => {
    try {
      const sheets = buildEndpointWorkbookSheets(endpoints, apiData);
      await downloadExcelWorkbook(`${baseName}-${date}.xlsx`, sheets);
      toast.success("Excel downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const handleOpenApi = () => {
    downloadOpenApiJson(`${baseName}-openapi.json`, apiData);
    toast.success("OpenAPI JSON downloaded");
  };

  const handlePostman = () => {
    const collection = openApiToPostmanCollection(
      specTitle,
      baseUrl,
      endpoints
    );
    downloadPostmanCollection(`${baseName}-postman.json`, collection);
    toast.success("Postman collection downloaded");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5 h-8 text-xs">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handleExcel()}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenApi}>
          <FileJson className="h-4 w-4 mr-2" />
          OpenAPI JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePostman}>
          <Package className="h-4 w-4 mr-2" />
          Postman collection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
