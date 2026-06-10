import type React from "react";

/** Full-viewport layout for ER diagram pages. */
export default function ErdLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
