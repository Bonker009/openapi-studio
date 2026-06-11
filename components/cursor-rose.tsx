"use client";

import { useEffect, useState } from "react";
import { useCursorRoseSettings } from "@/hooks/use-cursor-rose-settings";
import { hexToRgba } from "@/lib/cursor-rose-settings";

export function CursorRose() {
  const { settings } = useCursorRoseSettings();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!settings.enabled) {
      setPos(null);
      return;
    }

    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [settings.enabled]);

  if (!settings.enabled || pos === null) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`,
      }}
    >
      <div
        className="size-10 rounded-full"
        style={{
          backgroundColor: hexToRgba(settings.color, settings.opacity),
        }}
      />
    </div>
  );
}
