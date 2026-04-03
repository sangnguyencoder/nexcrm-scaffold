import { cn, formatCustomerType, getCustomerTypeColor, getInitials } from "@/lib/utils";
import type { CustomerType } from "@/types";

export function CustomerAvatar({
  name,
  type,
  className,
}: {
  name: string;
  type: CustomerType;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full font-semibold",
        getCustomerTypeColor(type),
        className,
      )}
      title={formatCustomerType(type)}
    >
      {getInitials(name)}
    </div>
  );
}
