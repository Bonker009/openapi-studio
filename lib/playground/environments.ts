import type { PlaygroundEnvironment } from "@/lib/playground/storage";

/** Build environments from OpenAPI servers with unique ids and disambiguated names. */
export function serversToEnvironments(
  servers?: { url: string; description?: string }[]
): PlaygroundEnvironment[] {
  if (!servers?.length) {
    return [
      {
        id: "default",
        name: "Default",
        url: "http://localhost:8080",
      },
    ];
  }

  const nameCounts: Record<string, number> = {};

  return servers.map((s, i) => {
    const base = s.description?.trim() || `Server ${i + 1}`;
    nameCounts[base] = (nameCounts[base] ?? 0) + 1;
    const count = nameCounts[base];
    const name = count === 1 ? base : `${base} (${count})`;

    return {
      id: `spec-${i}`,
      name,
      url: s.url.replace(/\/$/, ""),
    };
  });
}

/** Drop duplicate URLs; preserve first occurrence. */
export function dedupeEnvironmentsByUrl(
  envs: PlaygroundEnvironment[]
): PlaygroundEnvironment[] {
  const seen = new Set<string>();
  return envs.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

export function mergeSpecAndCustomEnvironments(
  fromSpec: PlaygroundEnvironment[],
  custom: PlaygroundEnvironment[]
): PlaygroundEnvironment[] {
  return dedupeEnvironmentsByUrl([...fromSpec, ...custom]);
}

/** Resolve active env by stored id (preferred) or legacy name. */
export function resolveActiveEnvironment(
  envs: PlaygroundEnvironment[],
  stored: string | null
): PlaygroundEnvironment | undefined {
  if (!stored || envs.length === 0) return envs[0];
  return (
    envs.find((e) => e.id === stored) ??
    envs.find((e) => e.name === stored) ??
    envs[0]
  );
}
