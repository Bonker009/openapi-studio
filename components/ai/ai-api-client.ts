export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

export async function postJson<T>(
  url: string,
  payload: Record<string, unknown>
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: json.error || `Request failed (${response.status})`,
      };
    }
    return { ok: true, status: response.status, data: json };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}
