"use server";

import { assertSafeOutboundUrl, SsrfError } from "@/lib/security/ssrf-server";

export async function fetchApiSpecFromUrl(
  apiUrl: string
): Promise<{ spec: string; name: string }> {
  let safeUrl: URL;
  try {
    safeUrl = await assertSafeOutboundUrl(apiUrl);
  } catch (e) {
    const message = e instanceof SsrfError ? e.message : "URL not allowed";
    throw new Error(message);
  }

  const response = await fetch(safeUrl.toString(), { redirect: "manual" });

  if (response.status >= 300 && response.status < 400) {
    throw new Error("Redirects are not allowed when fetching OpenAPI specs");
  }

  if (!response.ok) {
    console.error(response.status, response.statusText);
    throw new Error(
      `Failed to fetch API spec: ${response.status} ${response.statusText}`
    );
  }
  const data = await response.json();
  const spec = JSON.stringify(data, null, 2);

  const urlParts = apiUrl.split("/");
  const hostPart = urlParts[2];
  const name = hostPart ? hostPart.split(":")[0] : "default";

  return { spec, name };
}
