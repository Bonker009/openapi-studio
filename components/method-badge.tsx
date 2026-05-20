import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const methodStyles: Record<string, string> = {
  GET: "bg-primary/10 text-primary border-primary/20",
  POST: "bg-teal-100 text-teal-800 border-teal-200",
  PUT: "bg-amber-100 text-amber-800 border-amber-200",
  PATCH: "bg-violet-100 text-violet-800 border-violet-200",
  DELETE: "bg-destructive/10 text-destructive border-destructive/20",
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
