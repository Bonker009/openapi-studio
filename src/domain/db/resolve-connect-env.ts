import { existsSync } from "node:fs";
import { parse as parseConnectionString } from "pg-connection-string";

export type DbConnectEnvDefaults = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  label: string;
};

function isLoopbackHost(host: string): boolean {
  const lower = host.trim().toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1";
}

function inDockerContainer(): boolean {
  return existsSync("/.dockerenv");
}

/**
 * Map loopback to a host-reachable address when the app runs inside Docker (bridge network).
 * - DB_CONNECT_DOCKER_HOST_REWRITE=false → keep 127.0.0.1 (use with network_mode: host)
 * - DB_CONNECT_DOCKER_PROXY_PORT → host.docker.internal + proxy port (host-db-proxy compose)
 * - default → host.docker.internal (requires Postgres on 172.17.0.1 or LAN IP)
 */
export function resolveDbConnectHost(host: string): string {
  const trimmed = host.trim();
  if (process.env.DB_CONNECT_DOCKER_HOST_REWRITE === "false") {
    return trimmed;
  }
  if (!inDockerContainer() || !isLoopbackHost(trimmed)) {
    return trimmed;
  }
  const override = process.env.DB_CONNECT_DOCKER_HOST?.trim();
  return override || "host.docker.internal";
}

export function dockerHostDbProxyPort(
  originalHost: string,
  defaultPort: number
): number | null {
  if (process.env.DB_CONNECT_DOCKER_HOST_REWRITE === "false") return null;
  if (!isLoopbackHost(originalHost)) return null;
  const proxyPort = Number(process.env.DB_CONNECT_DOCKER_PROXY_PORT);
  if (!Number.isFinite(proxyPort) || proxyPort <= 0) return null;
  return proxyPort;
}

export function resolveDbConnectPort(host: string, port: number): number {
  if (inDockerContainer()) {
    const proxy = dockerHostDbProxyPort(host, port);
    if (proxy) return proxy;
  }
  return port;
}

export function parseDbUrl(raw: string): {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
} {
  let uri = raw.trim();
  if (uri.toLowerCase().startsWith("jdbc:")) {
    uri = uri.slice(5);
  }
  const parsed = parseConnectionString(uri);
  if (!parsed.host || !parsed.database) {
    throw new Error("DB_URL must include host and database name");
  }
  return {
    host: parsed.host,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.database,
    username: parsed.user?.trim() ?? "",
    password: parsed.password ?? "",
  };
}

/**
 * Optional dev defaults from DB_URL (+ DB_USERNAME / DB_PASSWORD).
 * Supports jdbc:postgresql://… and postgresql://…
 */
export function getDbConnectEnvDefaults(): DbConnectEnvDefaults | null {
  const urlRaw = process.env.DB_URL?.trim();
  if (!urlRaw) return null;

  try {
    const parsed = parseDbUrl(urlRaw);
    const username =
      process.env.DB_USERNAME?.trim() || parsed.username;
    const password =
      process.env.DB_PASSWORD ?? parsed.password;
    if (!username) return null;

    const host = resolveDbConnectHost(parsed.host);
    return {
      host,
      port: resolveDbConnectPort(parsed.host, parsed.port),
      database: parsed.database,
      username,
      password,
      label:
        process.env.DB_CONNECT_LABEL?.trim() ||
        parsed.database,
    };
  } catch {
    return null;
  }
}

export function shouldExposeDbConnectPassword(): boolean {
  if (process.env.DB_CONNECT_EXPOSE_DEFAULTS === "true") return true;
  return process.env.NODE_ENV !== "production";
}
