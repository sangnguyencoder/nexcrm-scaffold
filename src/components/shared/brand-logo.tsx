import { useEffect, useMemo, useState } from "react";

import { cn, getDefaultLogoUrl, getInitials, isValidAssetUrl, resolveLogoUrl } from "@/lib/utils";

type BrandLogoProps = {
  src?: string | null;
  alt: string;
  fallbackLabel?: string;
  className?: string;
  imageClassName?: string;
  initialsClassName?: string;
};

export function BrandLogo({
  src,
  alt,
  fallbackLabel,
  className,
  imageClassName,
  initialsClassName,
}: BrandLogoProps) {
  const defaultLogo = getDefaultLogoUrl();
  const normalizedSource = resolveLogoUrl(src);
  const [currentSource, setCurrentSource] = useState(normalizedSource);

  useEffect(() => {
    setCurrentSource(normalizedSource);
  }, [normalizedSource]);

  const initials = useMemo(
    () => getInitials(fallbackLabel || alt || "CRM") || "CRM",
    [alt, fallbackLabel],
  );

  if (!currentSource || !isValidAssetUrl(currentSource)) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-xs font-semibold uppercase tracking-[0.18em] text-primary",
          className,
          initialsClassName,
        )}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl", className)}>
      <img
        src={currentSource}
        alt={alt}
        className={cn("h-full w-full object-contain", imageClassName)}
        onError={() => {
          if (currentSource !== defaultLogo) {
            setCurrentSource(defaultLogo);
            return;
          }

          setCurrentSource("");
        }}
      />
    </div>
  );
}
