import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type LoadingSpinnerProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const spinnerSizeMap: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

export function LoadingSpinner({
  label = "Đang tải...",
  size = "md",
  className,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className={cn("animate-spin text-primary", spinnerSizeMap[size])} />
      <span>{label}</span>
    </div>
  );
}

