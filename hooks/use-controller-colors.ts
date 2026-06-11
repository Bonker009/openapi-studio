"use client";

import { useCallback } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  getControllerRowStyle as getRowStyle,
  getControllerBadgeStyle as getBadgeStyle,
} from "@/lib/controller-colors";

export function useControllerColors() {
  const dark = useDarkMode();

  const getControllerRowStyle = useCallback(
    (controller: string) => getRowStyle(controller, dark),
    [dark]
  );

  const getControllerBadgeStyle = useCallback(
    (controller: string) => getBadgeStyle(controller, dark),
    [dark]
  );

  return { getControllerRowStyle, getControllerBadgeStyle };
}
