import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const methodStyles: Record<string, string> = {
  GET: "bg-method-get/15 text-method-get-foreground border-method-get/30",
  POST: "bg-method-post/15 text-method-post-foreground border-method-post/30",
  PUT: "bg-method-put/15 text-method-put-foreground border-method-put/30",
  PATCH: "bg-method-patch/15 text-method-patch-foreground border-method-patch/30",
  DELETE: "bg-method-delete/15 text-method-delete-foreground border-method-delete/30",
};

export function MethodBadge({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const key = method.toUpperCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold uppercase tabular-nums",
        methodStyles[key] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {key}
    </Badge>
  );
}
