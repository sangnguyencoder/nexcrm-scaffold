import type { HTMLAttributes } from "react";
import { useState } from "react";

import { cn, getInitials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
}: HTMLAttributes<HTMLDivElement> & { name: string; src?: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);

  return (
    <div
      className={cn(
        "inline-flex size-10 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted font-semibold text-foreground",
        className,
      )}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
