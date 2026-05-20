import type { Metadata } from "next";
import type React from "react";
import "@/app/globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Poseidon — API Explorer",
  description:
    "Upload OpenAPI specs, explore endpoints, track versions, and run API tests.",
};

/** Avoid static prerender loopback fetches that break in Docker (ECONNREFUSED on ::1). */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body className={`${jakarta.className} min-h-screen`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
