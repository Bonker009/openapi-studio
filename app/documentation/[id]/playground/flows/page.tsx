"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FlowShell } from "@/components/playground/flow-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePlaygroundSpec } from "@/src/features/playground/hooks/usePlaygroundSpec";

export default function FlowTestsPage() {
  const params = useParams();
  const id = params?.id as string;
  const { apiData, loading, error } = usePlaygroundSpec(id);

  const title = apiData?.info?.title ?? "Flow tests";

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <Skeleton className="h-24 w-full shrink-0 rounded-none" />
        <div className="flex-1 px-6 py-6">
          <Skeleton className="h-full w-full rounded-xl" />
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
            <Link href={`/documentation/${id}/playground`}>Back to playground</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!apiData) return null;

  return (
    <FlowShell
      specId={id}
      specTitle={title}
      specVersion={apiData.info?.version}
      apiData={apiData}
    />
  );
}
