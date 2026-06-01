/** Minimal HTTP result shape for flow execution (framework-agnostic). */
export type FlowHttpResult = {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: unknown;
  error?: string;
};

export type FlowExecutor = (
  url: string,
  init: RequestInit
) => Promise<FlowHttpResult>;
