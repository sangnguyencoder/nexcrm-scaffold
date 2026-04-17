import { memo } from "react";

import {
  cn,
  formatCustomerType,
  getCustomerTypeColor,
  getDefaultPersonAvatarUrl,
  normalizeAvatarGender,
  type AvatarGender,
} from "@/lib/utils";
import type { CustomerType } from "@/types";

export const CustomerAvatar = memo(function CustomerAvatar({
  name,
  type,
  gender,
  className,
}: {
  name: string;
  type: CustomerType;
  gender?: AvatarGender | string | null;
  className?: string;
}) {
  const avatarSrc = getDefaultPersonAvatarUrl(normalizeAvatarGender(gender, name));

  return (
    <div
      className={cn(
        "inline-flex size-11 items-center justify-center overflow-hidden rounded-full border border-current/10 bg-card shadow-xs",
        getCustomerTypeColor(type),
        className,
      )}
      title={formatCustomerType(type)}
    >
      <img src={avatarSrc} alt={name} className="size-full object-cover" />
    </div>
  );
});
