/** react-json-tree themes — explicit colors (library uses inline styles, not Tailwind). */

export type JsonTreeTheme = Record<string, string>;

/** Light surfaces (card / muted backgrounds). */
export const jsonTreeThemeLight: JsonTreeTheme = {
  base00: "#f8fafc",
  base01: "#f1f5f9",
  base02: "#e2e8f0",
  base03: "#94a3b8",
  base04: "#64748b",
  base05: "#334155",
  base06: "#1e293b",
  base07: "#0f172a",
  base08: "#dc2626",
  base09: "#7c3aed",
  base0A: "#b45309",
  base0B: "#0d9488",
  base0C: "#2563eb",
  base0D: "#00518d",
  base0E: "#be185d",
  base0F: "#c2410c",
};

/** Dark surfaces. */
export const jsonTreeThemeDark: JsonTreeTheme = {
  base00: "#1e293b",
  base01: "#334155",
  base02: "#475569",
  base03: "#64748b",
  base04: "#94a3b8",
  base05: "#cbd5e1",
  base06: "#e2e8f0",
  base07: "#f1f5f9",
  base08: "#f87171",
  base09: "#a78bfa",
  base0A: "#fbbf24",
  base0B: "#2dd4bf",
  base0C: "#60a5fa",
  base0D: "#93c5fd",
  base0E: "#f472b6",
  base0F: "#fb923c",
};

/** @deprecated use useJsonTreeTheme hook */
export const jsonTreeTheme = jsonTreeThemeLight;
