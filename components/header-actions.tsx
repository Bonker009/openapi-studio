"use client";

import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DEFAULT_CURSOR_ROSE_SETTINGS,
  hexToRgba,
} from "@/lib/cursor-rose-settings";

const CursorRoseSettingsButton = dynamic(
  () =>
    import("@/components/cursor-rose-settings").then(
      (m) => m.CursorRoseSettingsButton,
    ),
  {
    ssr: false,
    loading: () => (
      <span
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md"
        aria-hidden
      >
        <span
          className="size-5 rounded-full"
          style={{
            backgroundColor: hexToRgba(
              DEFAULT_CURSOR_ROSE_SETTINGS.color,
              DEFAULT_CURSOR_ROSE_SETTINGS.opacity,
            ),
          }}
        />
      </span>
    ),
  },
);

export function HeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <CursorRoseSettingsButton />
      <ThemeToggle />
    </div>
  );
}
