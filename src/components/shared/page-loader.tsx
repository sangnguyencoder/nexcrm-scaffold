import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PageLoader({
  panels = 3,
  className = "",
}: {
  panels?: number;
  className?: string;
}) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: panels }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-4 w-52 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-36 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
