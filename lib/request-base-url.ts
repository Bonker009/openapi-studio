/**
 * Base URL for same-origin API calls from the Node.js server.
 * Relative fetch URLs fail or hit the wrong address in Docker; use 127.0.0.1 explicitly.
 */
export function getRequestBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  const configured = process.env.INTERNAL_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}
