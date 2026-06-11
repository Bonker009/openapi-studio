"use client";

import dynamic from "next/dynamic";

const CursorRose = dynamic(
  () => import("@/components/cursor-rose").then((m) => m.CursorRose),
  { ssr: false },
);

export function CursorRoseLazy() {
  return <CursorRose />;
}
