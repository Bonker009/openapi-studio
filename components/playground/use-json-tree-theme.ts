"use client";

import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  jsonTreeThemeDark,
  jsonTreeThemeLight,
  type JsonTreeTheme,
} from "@/lib/playground/json-tree-theme";

export function useJsonTreeTheme(): JsonTreeTheme {
  const dark = useDarkMode();
  return dark ? jsonTreeThemeDark : jsonTreeThemeLight;
}
