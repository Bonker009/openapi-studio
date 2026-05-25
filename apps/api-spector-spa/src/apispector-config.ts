export type DocExpansion = "list" | "full" | "none";

export type ApiSpectorInitOptions = {
  domNode: string | HTMLElement;
  specUrl?: string;
  spec?: Record<string, unknown>;
  proxyUrl?: string | null;
  oauth2TokenUrl?: string | null;
  deepLinking?: boolean;
  tryItEnabled?: boolean;
  filter?: boolean;
  docExpansion?: DocExpansion;
  displayRequestDuration?: boolean;
  persistAuthorization?: boolean;
  defaultEnvironment?: { url: string };
};

let globalConfig: ApiSpectorInitOptions | null = null;

export function setApiSpectorConfig(config: ApiSpectorInitOptions) {
  globalConfig = config;
}

export function getApiSpectorConfig(): ApiSpectorInitOptions {
  if (!globalConfig) {
    throw new Error("ApiSpector.init() must be called before rendering");
  }
  return globalConfig;
}

export function getProxyUrl(): string | null {
  return globalConfig?.proxyUrl ?? null;
}

export function getOAuth2TokenUrl(): string | null {
  return globalConfig?.oauth2TokenUrl ?? null;
}

export function isTryItEnabled(): boolean {
  return globalConfig?.tryItEnabled !== false;
}

export function isFilterEnabled(): boolean {
  return globalConfig?.filter !== false;
}

export function getDocExpansion(): DocExpansion {
  const v = globalConfig?.docExpansion;
  if (v === "full" || v === "none" || v === "list") return v;
  return "list";
}

export function isDisplayRequestDuration(): boolean {
  return globalConfig?.displayRequestDuration !== false;
}

export function isPersistAuthorization(): boolean {
  return globalConfig?.persistAuthorization === true;
}

export function isDeepLinkingEnabled(): boolean {
  return globalConfig?.deepLinking !== false;
}
