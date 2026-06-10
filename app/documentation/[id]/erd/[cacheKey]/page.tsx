"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ErdViewerPage() {
  const params = useParams();
  const specId = params?.id as string;
  const cacheKey = params?.cacheKey as string;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cacheKey || !/^[a-f0-9]{16}$/.test(cacheKey)) {
      setError("Invalid diagram cache key");
      return;
    }
    const url = `/api/db/erd/${encodeURIComponent(specId)}/${cacheKey}/`;
    window.location.replace(url);
  }, [specId, cacheKey]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 gap-4 max-w-md mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Could not open diagram</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href={`/documentation/${specId}/erd`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to ER Diagram
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Opening Liam ERD viewer…</p>
    </div>
  );
}
