"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_CURSOR_ROSE_SETTINGS,
  getCursorRoseSettings,
  setCursorRoseSettings,
  subscribeCursorRoseSettings,
  type CursorRoseSettings,
} from "@/lib/cursor-rose-settings";

export function useCursorRoseSettings() {
  const settings = useSyncExternalStore(
    subscribeCursorRoseSettings,
    getCursorRoseSettings,
    () => DEFAULT_CURSOR_ROSE_SETTINGS,
  );

  const setSettings = useCallback((patch: Partial<CursorRoseSettings>) => {
    setCursorRoseSettings(patch);
  }, []);

  return { settings, setSettings };
}
