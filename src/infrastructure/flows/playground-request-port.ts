import { buildRequestUrl } from "@/lib/playground/build-request";
import { applyAuthToRequest } from "@/lib/playground/apply-auth";
import type { Credential } from "@/lib/playground/credentials";
import type {
  BuildStepRequestInput,
  BuildStepRequestResult,
  FlowRequestPort,
} from "@/domain/flows/requests/request-port";
import type { FlowCredential } from "@/domain/flows/requests/credential-resolver";
import { resolveFlowCredential } from "@/domain/flows/requests/credential-resolver";

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toPlaygroundCredential(c: FlowCredential | null): Credential | null {
  if (!c) return null;
  return c as unknown as Credential;
}

export function createPlaygroundRequestPort(): FlowRequestPort {
  return {
    buildStepRequest(input: BuildStepRequestInput): BuildStepRequestResult {
      const {
        step,
        flow,
        endpoint,
        ctx,
        baseUrl,
        credentials,
        defaultCredential,
      } = input;

      const role = resolveFlowCredential(
        step,
        flow,
        ctx,
        credentials,
        defaultCredential
      );

      let url = buildRequestUrl(
        baseUrl,
        endpoint.path,
        step.paramValues,
        endpoint.parameters as Parameters<typeof buildRequestUrl>[3]
      );

      const headers: Record<string, string> = { Accept: "application/json" };
      for (const [k, v] of Object.entries(step.headerValues)) {
        if (v) headers[k] = v;
      }

      const method = endpoint.method.toUpperCase();
      const init: RequestInit = { method, headers };

      if (step.body && method !== "GET" && method !== "HEAD") {
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
        init.body = step.body;
      }

      const authed = applyAuthToRequest(
        toPlaygroundCredential(role.credential),
        url,
        init,
        endpoint.requiresAuth
      );
      url = authed.url;

      const requestPreview = JSON.stringify(
        {
          url,
          method,
          role: role.roleUsed,
          headers: authed.init.headers,
          body: step.body ? safeParse(step.body) : null,
        },
        null,
        2
      );

      return {
        ok: true,
        request: {
          url,
          init: authed.init,
          requestPreview,
          roleUsed: role.roleUsed,
          missingRole: role.missingRole,
        },
      };
    },
  };
}
