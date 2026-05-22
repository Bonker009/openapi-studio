"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PlaygroundShell } from "@/components/playground/playground-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchData } from "@/lib/data-service";
import { toast } from "sonner";

export default function PlaygroundPage() {
  const params = useParams();
  const id = params?.id as string;

  const [apiData, setApiData] = useState<{
    info?: { title?: string; version?: string };
    paths?: Record<string, unknown>;
    components?: unknown;
    servers?: { url: string; description?: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const spec = await fetchData("spec", id);
        if (!spec) {
          setError(`API specification '${id}' not found`);
          return;
        }
        setApiData(spec);
      } catch {
        setError("Failed to load API specification");
        toast.error("Failed to load playground");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const title = apiData?.info?.title ?? "API Playground";

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
            <Link href={`/documentation/${id}`}>Back to documentation</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!apiData) return null;

  return (
    <PlaygroundShell
      specId={id}
      specTitle={title}
      specVersion={apiData.info?.version}
      apiData={apiData}
    />
  );
}
