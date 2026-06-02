import { downloadValidationResultsExcel } from "@/src/domain/export/excel-export-service";
import type { ValidationResult } from "@/src/domain/validation/types";

export function validationExportFilename(specId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `validation-${specId}-${date}.xlsx`;
}

export async function exportValidationResultsToExcel(
  specId: string,
  results: ValidationResult[]
): Promise<void> {
  await downloadValidationResultsExcel(validationExportFilename(specId), results);
}
