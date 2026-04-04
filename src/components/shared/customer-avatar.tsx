import { memo } from "react";

import { cn, formatCustomerType, getCustomerTypeColor, getInitials } from "@/lib/utils";
import type { CustomerType } from "@/types";

export const CustomerAvatar = memo(function CustomerAvatar({
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
        "inline-flex size-11 items-center justify-center rounded-lg border border-current/10 font-semibold shadow-xs",
        getCustomerTypeColor(type),
        className,
      )}
      title={formatCustomerType(type)}
    >
      {getInitials(name)}
    </div>
  );
});
