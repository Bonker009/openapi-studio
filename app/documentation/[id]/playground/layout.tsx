import type React from "react";

/** Full-viewport layout for playground — no app documentation header nav. */
export default function PlaygroundLayout({
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
