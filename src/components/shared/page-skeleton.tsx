import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageSkeletonProps = {
  sections?: number;
  className?: string;
};

export function PageSkeleton({ sections = 3, className }: PageSkeletonProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: sections }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-7 w-56 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-48 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

