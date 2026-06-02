import type ExcelJS from "exceljs";
import {
  groupResultsByEndpoint,
  topFailureVariants,
  validationAggregate,
} from "@/src/domain/validation/aggregate";
import type { ValidationResult } from "@/src/domain/validation/types";

export type ExportColumn = {
  id: string;
  label: string;
};

/** Brand and semantic colors (ARGB without #, prefixed with FF in exceljs). */
const COLORS = {
  brandPrimary: "FF00518D",
  brandAccent: "FFEA1D24",
  headerText: "FFFFFFFF",
  border: "FFE2E8F0",
  rowEven: "FFF8FAFC",
  rowOdd: "FFFFFFFF",
  text: "FF1E293B",
  textMuted: "FF64748B",
  workingBg: "FFDCFCE7",
  workingText: "FF166534",
  notWorkingBg: "FFFEE2E2",
  notWorkingText: "FF991B1B",
  passBg: "FFDCFCE7",
  passText: "FF166534",
  failBg: "FFFEF3C7",
  failText: "FF92400E",
  errorBg: "FFFEE2E2",
  errorText: "FF991B1B",
  skippedBg: "FFF1F5F9",
  skippedText: "FF64748B",
} as const;

const VALIDATION_RESULT_COLUMNS: ExportColumn[] = [
  { id: "outcome", label: "Outcome" },
  { id: "method", label: "Method" },
  { id: "path", label: "Path" },
  { id: "controller", label: "Controller" },
  { id: "category", label: "Category" },
  { id: "fieldPath", label: "Field" },
  { id: "variant", label: "Variant" },
  { id: "name", label: "Case" },
  { id: "httpStatus", label: "HTTP Status" },
  { id: "latencyMs", label: "Latency (ms)" },
  { id: "error", label: "Error" },
  { id: "skipped", label: "Skipped reason" },
];

const OUTCOME_ORDER: Record<string, number> = {
  error: 0,
  fail: 1,
  skipped: 2,
  pass: 3,
};

const METHOD_FILLS: Record<string, { bg: string; text: string }> = {
  GET: { bg: "FF00518D", text: "FFFFFFFF" },
  POST: { bg: "FF0D9488", text: "FFFFFFFF" },
  PUT: { bg: "FFD97706", text: "FFFFFFFF" },
  PATCH: { bg: "FF7C3AED", text: "FFFFFFFF" },
  DELETE: { bg: "FFEA1D24", text: "FFFFFFFF" },
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

export function slugifyFileName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "api-endpoints"
  );
}

function cellValue(row: Record<string, unknown>, col: ExportColumn): string {
  const v = row[col.id];
  if (v == null) return "";
  return String(v);
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 11, color: { argb: COLORS.headerText } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.brandPrimary },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = thinBorder;
}

function applyDataStyle(
  cell: ExcelJS.Cell,
  col: ExportColumn,
  raw: string,
  stripe: "even" | "odd"
) {
  cell.font = { size: 10, color: { argb: COLORS.text } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: stripe === "even" ? COLORS.rowEven : COLORS.rowOdd },
  };
  cell.border = thinBorder;

  if (col.id === "method") {
    const key = raw.toUpperCase();
    const methodStyle = METHOD_FILLS[key];
    if (methodStyle) {
      cell.font = { bold: true, size: 10, color: { argb: methodStyle.text } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: methodStyle.bg },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    } else {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    return;
  }

  if (col.id === "status") {
    const working = raw === "Working";
    cell.font = {
      bold: true,
      size: 10,
      color: { argb: working ? COLORS.workingText : COLORS.notWorkingText },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: working ? COLORS.workingBg : COLORS.notWorkingBg },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    return;
  }

  if (col.id === "path" || col.id === "operationId") {
    cell.font = { size: 10, name: "Consolas", color: { argb: COLORS.text } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    return;
  }

  if (col.id === "notes") {
    cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    return;
  }

  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
}

function applyValidationDataStyle(
  cell: ExcelJS.Cell,
  col: ExportColumn,
  raw: string,
  stripe: "even" | "odd"
) {
  cell.border = thinBorder;

  if (col.id === "outcome") {
    const key = raw.toLowerCase();
    const styles: Record<string, { bg: string; text: string }> = {
      pass: { bg: COLORS.passBg, text: COLORS.passText },
      fail: { bg: COLORS.failBg, text: COLORS.failText },
      error: { bg: COLORS.errorBg, text: COLORS.errorText },
      skipped: { bg: COLORS.skippedBg, text: COLORS.skippedText },
    };
    const style = styles[key];
    cell.font = {
      bold: true,
      size: 10,
      color: { argb: style?.text ?? COLORS.text },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: style?.bg ?? (stripe === "even" ? COLORS.rowEven : COLORS.rowOdd) },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    return;
  }

  if (col.id === "method") {
    applyDataStyle(cell, { id: "method", label: "Method" }, raw, stripe);
    return;
  }

  if (col.id === "path") {
    cell.font = { size: 10, name: "Consolas", color: { argb: COLORS.text } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: stripe === "even" ? COLORS.rowEven : COLORS.rowOdd },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    return;
  }

  if (col.id === "httpStatus") {
    const code = Number.parseInt(raw, 10);
    const ok = code >= 200 && code < 400;
    const client = code >= 400 && code < 500;
    cell.font = {
      bold: true,
      size: 10,
      color: {
        argb: ok
          ? COLORS.passText
          : client
            ? COLORS.failText
            : COLORS.errorText,
      },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: ok
          ? COLORS.passBg
          : client
            ? COLORS.failBg
            : COLORS.errorBg,
      },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    return;
  }

  if (col.id === "error" || col.id === "variant" || col.id === "name") {
    cell.font = { size: 10, color: { argb: COLORS.text } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: stripe === "even" ? COLORS.rowEven : COLORS.rowOdd },
    };
    cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    return;
  }

  cell.font = { size: 10, color: { argb: COLORS.text } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: stripe === "even" ? COLORS.rowEven : COLORS.rowOdd },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
}

function validationColumnWidth(
  col: ExportColumn,
  rows: Record<string, unknown>[]
): number {
  const maxData = rows.reduce((max, row) => {
    const len = cellValue(row, col).length;
    return Math.max(max, len);
  }, col.label.length);

  switch (col.id) {
    case "outcome":
      return 12;
    case "method":
      return 12;
    case "path":
      return Math.min(Math.max(maxData + 2, 28), 56);
    case "controller":
      return Math.min(Math.max(maxData + 2, 14), 28);
    case "category":
      return 14;
    case "fieldPath":
      return Math.min(Math.max(maxData + 2, 16), 36);
    case "variant":
      return Math.min(Math.max(maxData + 2, 18), 40);
    case "name":
      return Math.min(Math.max(maxData + 2, 20), 48);
    case "httpStatus":
      return 12;
    case "latencyMs":
      return 14;
    case "error":
      return Math.min(Math.max(maxData + 2, 24), 64);
    case "skipped":
      return Math.min(Math.max(maxData + 2, 18), 40);
    default:
      return Math.min(maxData + 2, 32);
  }
}

function validationResultsToRows(
  results: ValidationResult[]
): Record<string, unknown>[] {
  const sorted = [...results].sort((a, b) => {
    const oa = OUTCOME_ORDER[a.outcome] ?? 9;
    const ob = OUTCOME_ORDER[b.outcome] ?? 9;
    if (oa !== ob) return oa - ob;
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) return pathCmp;
    return a.method.localeCompare(b.method);
  });

  return sorted.map((r) => ({
    outcome: r.outcome,
    method: r.method,
    path: r.path,
    controller: r.controller,
    category: r.category,
    fieldPath: r.fieldPath || "—",
    variant: r.variant || "—",
    name: r.name,
    httpStatus: r.status > 0 ? r.status : "",
    latencyMs: r.latencyMs > 0 ? r.latencyMs : "",
    error: r.error ?? "",
    skipped: r.skipped ?? "",
  }));
}

function triggerXlsxDownload(buffer: ArrayBuffer, filename: string): void {
  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function addValidationResultsSheet(
  workbook: ExcelJS.Workbook,
  rows: Record<string, unknown>[]
): void {
  const columns = VALIDATION_RESULT_COLUMNS;
  const sheet = workbook.addWorksheet("Results", {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2" }],
  });

  sheet.columns = columns.map((col) => ({
    key: col.id,
    width: validationColumnWidth(col, rows),
  }));

  const headerRow = sheet.addRow(columns.map((c) => c.label));
  headerRow.height = 28;
  headerRow.eachCell((cell) => applyHeaderStyle(cell));

  rows.forEach((row, index) => {
    const stripe = index % 2 === 0 ? "even" : "odd";
    const dataRow = sheet.addRow(columns.map((col) => cellValue(row, col)));
    const tall = columns.some((c) =>
      ["error", "variant", "name"].includes(c.id)
    );
    dataRow.height = tall ? 36 : 22;
    dataRow.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      if (!col) return;
      applyValidationDataStyle(cell, col, String(cell.value ?? ""), stripe);
    });
  });

  const lastCol = sheet.getColumn(columns.length).letter;
  const lastRow = Math.max(rows.length + 1, 1);
  sheet.autoFilter = { from: "A1", to: `${lastCol}${lastRow}` };
}

function addValidationSummarySheet(
  workbook: ExcelJS.Workbook,
  results: ValidationResult[]
): void {
  const agg = validationAggregate(results);
  const sheet = workbook.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2" }],
  });

  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 48;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 14;

  const titleRow = sheet.addRow(["Validation run summary"]);
  titleRow.height = 24;
  titleRow.getCell(1).font = {
    bold: true,
    size: 14,
    color: { argb: COLORS.brandPrimary },
  };
  sheet.mergeCells(`A${titleRow.number}:E${titleRow.number}`);

  sheet.addRow([]);

  const metrics: [string, string | number][] = [
    ["Total cases", agg.total],
    ["Passed", agg.passed],
    ["Failed", agg.failed],
    ["Errors", agg.errors],
    ["Skipped", agg.skipped],
    ["Average latency (ms)", agg.avgLatencyMs],
  ];
  if (agg.slowest) {
    metrics.push([
      "Slowest case",
      `${agg.slowest.method} ${agg.slowest.path} (${agg.slowest.latencyMs} ms)`,
    ]);
  }

  const metricsHeader = sheet.addRow(["Metric", "Value"]);
  metricsHeader.height = 26;
  metricsHeader.eachCell((cell, colNumber) => {
    if (colNumber <= 2) applyHeaderStyle(cell);
  });

  for (const [label, value] of metrics) {
    const row = sheet.addRow([label, value]);
    row.height = 22;
    row.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.text } };
    row.getCell(2).font = { size: 10, color: { argb: COLORS.text } };
    row.eachCell((cell) => {
      cell.border = thinBorder;
    });
  }

  sheet.addRow([]);

  const failingEndpoints = groupResultsByEndpoint(results)
    .filter((g) => g.aggregate.failed > 0 || g.aggregate.errors > 0)
    .sort(
      (a, b) =>
        b.aggregate.failed +
        b.aggregate.errors -
        (a.aggregate.failed + a.aggregate.errors)
    )
    .slice(0, 15);

  if (failingEndpoints.length > 0) {
    const epTitle = sheet.addRow(["Top failing endpoints"]);
    epTitle.getCell(1).font = { bold: true, size: 12, color: { argb: COLORS.text } };
    sheet.mergeCells(`A${epTitle.number}:E${epTitle.number}`);

    const epHeader = sheet.addRow([
      "Method",
      "Path",
      "Failed",
      "Errors",
      "Total cases",
    ]);
    epHeader.height = 26;
    epHeader.eachCell((cell) => applyHeaderStyle(cell));

    for (const group of failingEndpoints) {
      const row = sheet.addRow([
        group.method,
        group.path,
        group.aggregate.failed,
        group.aggregate.errors,
        group.aggregate.total,
      ]);
      row.height = 22;
      row.eachCell((cell, colNumber) => {
        const col =
          colNumber === 1
            ? { id: "method", label: "Method" }
            : colNumber === 2
              ? { id: "path", label: "Path" }
              : { id: "controller", label: "" };
        applyValidationDataStyle(
          cell,
          col,
          String(cell.value ?? ""),
          "odd"
        );
      });
    }

    sheet.addRow([]);
  }

  const variants = topFailureVariants(results, 15);
  if (variants.length > 0) {
    const varTitle = sheet.addRow(["Top failure patterns"]);
    varTitle.getCell(1).font = { bold: true, size: 12, color: { argb: COLORS.text } };
    sheet.mergeCells(`A${varTitle.number}:C${varTitle.number}`);

    const varHeader = sheet.addRow(["Field", "Variant", "Count"]);
    varHeader.height = 26;
    varHeader.eachCell((cell) => applyHeaderStyle(cell));

    for (const item of variants) {
      const row = sheet.addRow([item.fieldPath, item.variant, item.count]);
      row.height = 22;
      row.eachCell((cell, colNumber) => {
        const col =
          colNumber === 1
            ? { id: "fieldPath", label: "Field" }
            : colNumber === 2
              ? { id: "variant", label: "Variant" }
              : { id: "latencyMs", label: "Count" };
        applyValidationDataStyle(
          cell,
          col,
          String(cell.value ?? ""),
          "even"
        );
      });
    }
  }
}

export async function downloadValidationResultsExcel(
  filename: string,
  results: ValidationResult[]
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "List Endpoints";
  workbook.created = new Date();

  addValidationSummarySheet(workbook, results);
  addValidationResultsSheet(workbook, validationResultsToRows(results));

  const buffer = await workbook.xlsx.writeBuffer();
  triggerXlsxDownload(buffer, filename);
}

function columnWidth(col: ExportColumn, rows: Record<string, unknown>[]): number {
  const headerLen = col.label.length;
  const maxData = rows.reduce((max, row) => {
    const len = cellValue(row, col).length;
    return Math.max(max, len);
  }, 0);
  const base = Math.max(headerLen, maxData) + 2;
  switch (col.id) {
    case "method":
      return 12;
    case "status":
      return 14;
    case "path":
      return Math.min(Math.max(base, 24), 72);
    case "notes":
      return Math.min(Math.max(base, 28), 80);
    default:
      return Math.min(base, 48);
  }
}

export async function downloadExcel(
  filename: string,
  rows: Record<string, unknown>[],
  columns: ExportColumn[]
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "List Endpoints";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Endpoints", {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2" }],
  });

  sheet.columns = columns.map((col) => ({
    key: col.id,
    width: columnWidth(col, rows),
  }));

  const headerRow = sheet.addRow(columns.map((c) => c.label));
  headerRow.height = 28;
  headerRow.eachCell((cell) => applyHeaderStyle(cell));

  rows.forEach((row, index) => {
    const stripe = index % 2 === 0 ? "even" : "odd";
    const dataRow = sheet.addRow(columns.map((col) => cellValue(row, col)));
    dataRow.height = columns.some((c) => c.id === "notes") ? 22 : 20;
    dataRow.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1];
      if (!col) return;
      applyDataStyle(cell, col, String(cell.value ?? ""), stripe);
    });
  });

  const lastCol = sheet.getColumn(columns.length).letter;
  const lastRow = Math.max(rows.length + 1, 1);
  sheet.autoFilter = {
    from: "A1",
    to: `${lastCol}${lastRow}`,
  };

  const buffer = await workbook.xlsx.writeBuffer();
  triggerXlsxDownload(buffer, safeName);
}
