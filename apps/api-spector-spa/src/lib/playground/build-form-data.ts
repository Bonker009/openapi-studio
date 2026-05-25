export type MultipartFieldRow = {
  id: string;
  key: string;
  type: "text" | "file";
  textValue: string;
  file: File | null;
  required?: boolean;
  fromSchema?: boolean;
};

export type MultipartBodyState = {
  rows: MultipartFieldRow[];
};

export function createMultipartStateFromFields(
  fields: { name: string; required: boolean; isFile: boolean }[]
): MultipartBodyState {
  return {
    rows: fields.map((f) => ({
      id: `schema-${f.name}`,
      key: f.name,
      type: f.isFile ? "file" : "text",
      textValue: "",
      file: null,
      required: f.required,
      fromSchema: true,
    })),
  };
}

export function buildFormData(state: MultipartBodyState): FormData {
  const fd = new FormData();
  for (const row of state.rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (row.type === "file" && row.file) {
      fd.append(key, row.file, row.file.name);
    } else if (row.type === "text") {
      fd.append(key, row.textValue);
    }
  }
  return fd;
}

export function validateMultipartState(
  state: MultipartBodyState
): string | null {
  for (const row of state.rows) {
    if (!row.required) continue;
    const key = row.key.trim();
    if (!key) continue;
    if (row.type === "file" && !row.file) {
      return `Required file field "${key}" is missing`;
    }
  }
  return null;
}

export function estimateFormDataSize(state: MultipartBodyState): number {
  let total = 512;
  for (const row of state.rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (row.type === "file" && row.file) {
      total += row.file.size;
    } else if (row.type === "text") {
      total += new TextEncoder().encode(row.textValue).length;
    }
    total += key.length + 64;
  }
  return total;
}
