"use client";

import { useEffect, useState } from "react";
import {
  jsonTreeThemeDark,
  jsonTreeThemeLight,
  type JsonTreeTheme,
} from "@/lib/playground/json-tree-theme";

export function useJsonTreeTheme(): JsonTreeTheme {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return dark ? jsonTreeThemeDark : jsonTreeThemeLight;
}
