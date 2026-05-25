export const PROXY_URL_FIELD = "_proxy_url";
export const PROXY_METHOD_FIELD = "_proxy_method";
export const PROXY_HEADERS_FIELD = "_proxy_headers";
/** Raw octet-stream body when the client sends a single file/blob. */
export const PROXY_RAW_BODY_FIELD = "_proxy_body";

export function isProxyMetaField(name: string): boolean {
  return (
    name === PROXY_URL_FIELD ||
    name === PROXY_METHOD_FIELD ||
    name === PROXY_HEADERS_FIELD ||
    name === PROXY_RAW_BODY_FIELD
  );
}
