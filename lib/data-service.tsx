import type { DiffSummary } from "@/lib/openapi-diff";
import type { Flow } from "@/lib/flows/types";
import type { FlowRunResult } from "@/domain/flows/types";
import { getRequestBaseUrl } from "@/lib/request-base-url";

export type DataType = "spec" | "status" | "settings";

export type SpecSaveMeta = {
  note?: string;
  summary?: DiffSummary;
  isRestore?: boolean;
};

export type HistoryEntry = {
  ts: string;
  version: string;
  note?: string;
  summary?: DiffSummary;
  summaryLabel?: string;
  isRestore?: boolean;
};

export async function fetchData(type: DataType, id = "default") {
  try {
    const base = getRequestBaseUrl();
    const response = await fetch(`${base}/api/data?type=${type}&id=${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch data");
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${type} data:`, error);
    if (type === "spec") return null;
    return {};
  }
}

export async function saveData(
  type: DataType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  id = "default",
  meta?: SpecSaveMeta
) {
  try {
    const base = getRequestBaseUrl();
    const response = await fetch(`${base}/api/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, data, meta }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to save data");
    }

    return await response.json();
  } catch (error) {
    console.error(`Error saving ${type} data:`, error);
    throw error;
  }
}

export async function deleteData(type: DataType, id = "default") {
  try {
    const base = getRequestBaseUrl();
    const response = await fetch(`${base}/api/data?type=${type}&id=${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete data");
    }

    return await response.json();
  } catch (error) {
    console.error(`Error deleting ${type} data:`, error);
    throw error;
  }
}

export async function listSpecs() {
  try {
    const base = getRequestBaseUrl();
    const response = await fetch(`${base}/api/data/list?type=spec`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to list specs");
    }

    return await response.json();
  } catch (error) {
    console.error("Error listing specs:", error);
    return [];
  }
}

export async function deleteSpec(id: string) {
  return deleteData("spec", id);
}

export async function listVersions(id: string): Promise<{
  id: string;
  current: boolean;
  entries: HistoryEntry[];
}> {
  const base = getRequestBaseUrl();
  const response = await fetch(
    `${base}/api/data/history?id=${encodeURIComponent(id)}`
  );
  if (!response.ok) {
    throw new Error("Failed to load version history");
  }
  return response.json();
}

export async function getDiff(
  id: string,
  from: string,
  to = "current"
): Promise<{ summary: DiffSummary }> {
  const base = getRequestBaseUrl();
  const response = await fetch(
    `${base}/api/data/diff?id=${encodeURIComponent(id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  if (!response.ok) {
    throw new Error("Failed to compute diff");
  }
  const data = await response.json();
  return { summary: data.summary };
}

export async function restoreVersion(id: string, ts: string) {
  const base = getRequestBaseUrl();
  const response = await fetch(`${base}/api/data/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ts }),
  });
  if (!response.ok) {
    throw new Error("Failed to restore version");
  }
  return response.json();
}

export type EndpointNoteEntry = {
  id: number;
  specId: string;
  path: string;
  method: string;
  ts: number;
  kind: string;
  body: string;
};

export async function listEndpointNotes(
  specId: string,
  path: string,
  method: string
): Promise<EndpointNoteEntry[]> {
  const base = getRequestBaseUrl();
  const q = new URLSearchParams({
    id: specId,
    path,
    method,
  });
  const response = await fetch(`${base}/api/data/endpoint-notes?${q}`);
  if (!response.ok) throw new Error("Failed to load endpoint notes");
  const data = await response.json();
  return data.notes ?? [];
}

export async function appendEndpointNote(
  specId: string,
  path: string,
  method: string,
  noteBody: string,
  kind = "note"
): Promise<EndpointNoteEntry> {
  const base = getRequestBaseUrl();
  const response = await fetch(`${base}/api/data/endpoint-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: specId, path, method, noteBody, kind }),
  });
  if (!response.ok) throw new Error("Failed to add note");
  const data = await response.json();
  return data.note;
}

export async function deleteEndpointNote(
  specId: string,
  noteId: number
): Promise<void> {
  const base = getRequestBaseUrl();
  const q = new URLSearchParams({ id: specId, noteId: String(noteId) });
  const response = await fetch(`${base}/api/data/endpoint-notes?${q}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete note");
}

export async function listFlows(specId: string): Promise<Flow[]> {
  const base = getRequestBaseUrl();
  const q = new URLSearchParams({ id: specId });
  const response = await fetch(`${base}/api/data/flows?${q}`);
  if (!response.ok) throw new Error("Failed to load flows");
  const data = await response.json();
  return data.flows ?? [];
}

export async function saveFlow(flow: Flow): Promise<Flow> {
  const base = getRequestBaseUrl();
  const response = await fetch(`${base}/api/data/flows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(flow),
  });
  if (!response.ok) throw new Error("Failed to save flow");
  const data = await response.json();
  return data.flow;
}

export async function deleteFlow(specId: string, flowId: string): Promise<void> {
  const base = getRequestBaseUrl();
  const q = new URLSearchParams({ id: specId, flowId });
  const response = await fetch(`${base}/api/data/flows?${q}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete flow");
}

export async function persistFlowRun(flow: Flow, run: FlowRunResult): Promise<void> {
  const base = getRequestBaseUrl();
  const response = await fetch(`${base}/api/data/flow-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flow, run }),
  });
  if (!response.ok) {
    throw new Error("Failed to persist flow run metadata");
  }
}

export async function deleteVersion(id: string, ts: string) {
  const base = getRequestBaseUrl();
  const response = await fetch(
    `${base}/api/data/version?id=${encodeURIComponent(id)}&ts=${encodeURIComponent(ts)}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error("Failed to delete version");
  }
  return response.json();
}
