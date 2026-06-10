"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ErdPageShell } from "@/components/db/erd-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePlaygroundSpec } from "@/src/features/playground/hooks/usePlaygroundSpec";

export default function ErdLandingPage() {
  const params = useParams();
  const specId = params?.id as string;
  const { apiData, loading, error } = usePlaygroundSpec(specId);
  const title = apiData?.info?.title ?? "API";

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <Skeleton className="h-16 w-full shrink-0 rounded-none" />
        <div className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-12 text-center">
        <div>
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" asChild>
            <Link href={`/documentation/${specId}`}>Back to documentation</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <ErdPageShell specId={specId} specTitle={title} />;
}
