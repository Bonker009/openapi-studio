import type ExcelJS from "exceljs";

export type ExportColumn = {
  id: string;
  label: string;
};

export type ExportSheet = {
  name: string;
  rows: Record<string, unknown>[];
  columns: ExportColumn[];
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
} as const;

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

  if (col.id === "status" || col.id === "ok") {
    const working =
      raw === "Working" || raw === "true" || raw === "PASS" || raw === "Yes";
    const failed = raw === "false" || raw === "FAIL" || raw === "No";
    if (working || failed) {
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
    case "ok":
      return 14;
    case "path":
      return Math.min(Math.max(base, 24), 72);
    case "notes":
      return Math.min(Math.max(base, 28), 80);
    default:
      return Math.min(base, 48);
  }
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, "_").slice(0, 31);
  return cleaned || "Sheet";
}

function addSheet(workbook: ExcelJS.Workbook, sheetDef: ExportSheet) {
  const { rows, columns } = sheetDef;
  const sheet = workbook.addWorksheet(sanitizeSheetName(sheetDef.name), {
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

  if (columns.length > 0 && rows.length > 0) {
    const lastCol = sheet.getColumn(columns.length).letter;
    const lastRow = rows.length + 1;
    sheet.autoFilter = {
      from: "A1",
      to: `${lastCol}${lastRow}`,
    };
  }
}

export async function downloadExcelWorkbook(
  filename: string,
  sheets: ExportSheet[]
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "api-spector";
  workbook.created = new Date();

  for (const sheet of sheets) {
    addSheet(workbook, sheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
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

/** Single-sheet export (backwards compatible). */
export async function downloadExcel(
  filename: string,
  rows: Record<string, unknown>[],
  columns: ExportColumn[]
): Promise<void> {
  return downloadExcelWorkbook(filename, [
    { name: "Endpoints", rows, columns },
  ]);
}
