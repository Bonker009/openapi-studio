"use server";

interface FetchTesterResponse<T> {
  data: T | null;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  responseTime: number;
  error?: string;
}

export async function FetchTester<T = unknown>(
  url: string,
  requestOptions: RequestInit
): Promise<FetchTesterResponse<T>> {
  const startTime = performance.now();

  try {
    const response = await fetch(url, requestOptions);
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const text = await response.text();
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = text as unknown as T;
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      responseTime,
      error: response.ok ? undefined : response.statusText,
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      data: null,
      status: 0,
      statusText: "Request failed",
      headers: {},
      responseTime: Math.round(endTime - startTime),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
