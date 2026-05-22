"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, History, Upload, Zap } from "lucide-react";

type HeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  specId?: string;
  onHistoryClick?: () => void;
};

export function Header({
  title,
  description,
  eyebrow,
  showBackButton = false,
  showHomeButton = true,
  specId,
  onHistoryClick,
}: HeaderProps) {
  const pathname = usePathname();
  const onDocsPage =
    specId &&
    pathname.startsWith(`/documentation/${specId}`) &&
    !pathname.includes("/playground");

  return (
    <header className="sticky top-0 z-20 bg-card border-b border-border shadow-sm">
      <div className="h-1 bg-primary w-full" />
      <div className="container mx-auto max-w-screen-2xl flex flex-col md:flex-row items-center justify-between py-4 px-6 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          {showBackButton && (
            <Link href="/">
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
              </Button>
            </Link>
          )}

          {showHomeButton && (
            <Link href="/">
              <Button variant="ghost" size="icon" className="hover:bg-muted">
                <Home className="h-5 w-5" />
                <span className="sr-only">Home</span>
              </Button>
            </Link>
          )}

          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-medium text-muted-foreground mb-0.5 truncate">
                {eyebrow}
              </p>
            )}
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>
        <nav className="flex items-center gap-2 w-full md:w-auto justify-end">
          {onDocsPage && (
            <>
              {onHistoryClick ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={onHistoryClick}
                >
                  <History className="h-4 w-4" />
                  History
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link href={`/documentation/${specId}/history`}>
                    <History className="h-4 w-4" />
                    History
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href={`/documentation/${specId}/playground`}>
                  <Zap className="h-4 w-4" />
                  Playground
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href={`/upload?spec=${specId}`}>
                  <Upload className="h-4 w-4" />
                  New version
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
