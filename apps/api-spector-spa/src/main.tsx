import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./styles/globals.css";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import {
  setApiSpectorConfig,
  type ApiSpectorInitOptions,
} from "./apispector-config";

let root: Root | null = null;

function resolveDomNode(domNode: string | HTMLElement): HTMLElement {
  if (typeof domNode === "string") {
    const el = document.querySelector(domNode);
    if (!el) throw new Error(`ApiSpector: element not found: ${domNode}`);
    return el as HTMLElement;
  }
  return domNode;
}

function render(options: ApiSpectorInitOptions) {
  setApiSpectorConfig(options);
  const el = resolveDomNode(options.domNode);
  el.classList.add("h-full", "min-h-0", "flex", "flex-col");
  if (!root) {
    root = createRoot(el);
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

export const ApiSpector = {
  init(options: ApiSpectorInitOptions) {
    render(options);
  },
};

window.ApiSpector = ApiSpector;

type InjectedConfig = {
  specUrl?: string;
  spec?: Record<string, unknown>;
  proxyUrl?: string | null;
  oauth2TokenUrl?: string | null;
  deepLinking?: boolean;
  tryItEnabled?: boolean;
  filter?: boolean;
  docExpansion?: "list" | "full" | "none";
  displayRequestDuration?: boolean;
  persistAuthorization?: boolean;
  defaultEnvironment?: { url: string };
};

declare global {
  interface Window {
    ApiSpector: typeof ApiSpector;
    __API_SPECTOR_CONFIG__?: InjectedConfig;
  }
}

const mount = document.getElementById("api-spector");
const injected = window.__API_SPECTOR_CONFIG__;
if (mount) {
  ApiSpector.init({
    domNode: mount,
    specUrl: injected?.specUrl ?? (import.meta.env.DEV ? "/api-spector/api-docs" : undefined),
    spec: injected?.spec,
    proxyUrl: injected?.proxyUrl ?? null,
    oauth2TokenUrl: injected?.oauth2TokenUrl ?? null,
    deepLinking: injected?.deepLinking ?? true,
    tryItEnabled: injected?.tryItEnabled ?? true,
    filter: injected?.filter ?? true,
    docExpansion: injected?.docExpansion ?? "list",
    displayRequestDuration: injected?.displayRequestDuration ?? true,
    persistAuthorization: injected?.persistAuthorization ?? false,
    defaultEnvironment:
      injected?.defaultEnvironment ?? { url: window.location.origin },
  });
}
