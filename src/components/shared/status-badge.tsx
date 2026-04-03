import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  className?: string;
  dotClassName?: string;
};

export function StatusBadge({
  label,
  className,
  dotClassName,
}: StatusBadgeProps) {
  return (
    <Badge className={cn("gap-2 rounded-full", className)}>
      <span className={cn("size-2 rounded-full", dotClassName)} />
      {label}
    </Badge>
  );
}
