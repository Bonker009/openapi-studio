import type { CSSProperties } from "react";

/** Deterministic hue from controller name (stable across renders). */
export function controllerHue(controller: string): number {
  const name = controller?.trim() || "unknown";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function getControllerRowStyle(
  controller: string,
  isDark = false
): CSSProperties {
  const h = controllerHue(controller);
  return {
    backgroundColor: isDark
      ? `hsl(${h} 30% 18%)`
      : `hsl(${h} 52% 94%)`,
  };
}

export function getControllerBadgeStyle(
  controller: string,
  isDark = false
): CSSProperties {
  const h = controllerHue(controller);
  return isDark
    ? {
        backgroundColor: `hsl(${h} 35% 22%)`,
        color: `hsl(${h} 55% 78%)`,
        borderColor: `hsl(${h} 30% 32%)`,
      }
    : {
        backgroundColor: `hsl(${h} 52% 90%)`,
        color: `hsl(${h} 42% 28%)`,
        borderColor: `hsl(${h} 40% 78%)`,
      };
}
