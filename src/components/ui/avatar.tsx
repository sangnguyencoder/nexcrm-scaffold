import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";

import { cn, getInitials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
}: HTMLAttributes<HTMLDivElement> & { name: string; src?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <div
      className={cn(
        "inline-flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary",
        className,
      )}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={name}
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
