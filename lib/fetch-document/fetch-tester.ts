"use server";

import {
  performHttpRequest,
  type HttpRequestResult,
} from "@/lib/playground/perform-http-request-server";

export type FetchTesterResponse<T> = HttpRequestResult<T>;

export async function FetchTester<T = unknown>(
  url: string,
  requestOptions: RequestInit
): Promise<FetchTesterResponse<T>> {
  return performHttpRequest<T>(url, requestOptions);
}
