"use client";

import { useDarkMode } from "@/hooks/use-dark-mode";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export function useSyntaxHighlightStyle() {
  const dark = useDarkMode();
  return dark ? vscDarkPlus : oneLight;
}
