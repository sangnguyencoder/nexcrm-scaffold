import type { HTMLAttributes } from "react";
import { useState } from "react";
import { UserRound } from "lucide-react";

import {
  cn,
  getDefaultPersonAvatarUrl,
  normalizeAvatarGender,
  type AvatarGender,
} from "@/lib/utils";

export function Avatar({
  name,
  src,
  gender,
  className,
}: HTMLAttributes<HTMLDivElement> & { name: string; src?: string | null; gender?: AvatarGender | string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const fallbackSrc = getDefaultPersonAvatarUrl(normalizeAvatarGender(gender, name));
  const preferredSrc = src && failedSrc !== src ? src : fallbackSrc;
  const showImage = Boolean(preferredSrc && failedSrc !== preferredSrc);

  return (
    <div
      className={cn(
        "inline-flex size-10 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-muted/80 text-foreground",
        className,
      )}
    >
      {showImage ? (
        <img
          src={preferredSrc ?? undefined}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedSrc(preferredSrc ?? null)}
        />
      ) : (
        <UserRound className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}
