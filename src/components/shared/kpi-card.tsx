import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  description: string;
  trend: string;
  icon: LucideIcon;
  accentClassName: string;
};

export function KpiCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
  accentClassName,
}: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className={cn("rounded-2xl p-3", accentClassName)}>
          <Icon className="size-5" />
        </div>
        <Badge className="bg-muted text-muted-foreground ring-border">{trend}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="font-display text-3xl font-bold leading-none">{value}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  );
}
