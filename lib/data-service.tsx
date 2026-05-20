import type { DiffSummary } from "@/lib/openapi-diff";
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
