"use client";

import { useEffect, useState } from "react";
import type { ViewMode } from "../types";

const VIEW_STORAGE_KEY = "poseidon-home-view";

export function useViewPreference(defaultMode: ViewMode = "grid") {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode);

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "grid") {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  return { viewMode, setViewMode };
}
