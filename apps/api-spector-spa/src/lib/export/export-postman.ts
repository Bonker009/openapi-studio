import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";

type PostmanCollection = {
  info: {
    name: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: { key: string; value: string }[];
};

type PostmanItem = {
  name: string;
  item?: PostmanItem[];
  request?: {
    method: string;
    header: { key: string; value: string }[];
    url: {
      raw: string;
      host: string[];
      path: string[];
    };
    body?: {
      mode: string;
      raw?: string;
    };
  };
};

export function openApiToPostmanCollection(
  title: string,
  baseUrl: string,
  endpoints: PlaygroundEndpoint[]
): PostmanCollection {
  const base = baseUrl.replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    parsed = new URL("http://localhost:8080");
  }

  const byTag: Record<string, PlaygroundEndpoint[]> = {};
  for (const ep of endpoints) {
    if (!byTag[ep.controller]) byTag[ep.controller] = [];
    byTag[ep.controller].push(ep);
  }

  const item: PostmanItem[] = Object.entries(byTag)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, eps]) => ({
      name: tag,
      item: eps.map((ep) => {
        const pathParts = ep.path.split("/").filter(Boolean);
        const raw = `${base}${ep.path.startsWith("/") ? ep.path : `/${ep.path}`}`;
        const req: PostmanItem["request"] = {
          method: ep.method,
          header: [{ key: "Accept", value: "application/json" }],
          url: {
            raw,
            host: [parsed.host],
            path: pathParts,
          },
        };
        if (ep.hasRequestBody && !["GET", "HEAD"].includes(ep.method)) {
          req.body = { mode: "raw", raw: "{}" };
          req.header.push({ key: "Content-Type", value: "application/json" });
        }
        return {
          name: `${ep.method} ${ep.path}`,
          request: req,
        };
      }),
    }));

  return {
    info: {
      name: title,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item,
    variable: [{ key: "baseUrl", value: base }],
  };
}

export function downloadPostmanCollection(
  filename: string,
  collection: PostmanCollection
): void {
  const blob = new Blob([JSON.stringify(collection, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadOpenApiJson(
  filename: string,
  spec: Record<string, unknown>
): void {
  const blob = new Blob([JSON.stringify(spec, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
