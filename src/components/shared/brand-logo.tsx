import { useEffect, useMemo, useState } from "react";

import { cn, getDefaultLogoUrl, isValidAssetUrl, resolveLogoUrl } from "@/lib/utils";

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
  const markLogo = "/branding/nexcrm-mark.svg";
  const normalizedSource = resolveLogoUrl(src);
  const [currentSource, setCurrentSource] = useState(normalizedSource);

  useEffect(() => {
    setCurrentSource(normalizedSource);
  }, [normalizedSource]);

  const resolvedAlt = useMemo(() => fallbackLabel || alt || "NexCRM", [alt, fallbackLabel]);

  if (!currentSource || !isValidAssetUrl(currentSource)) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-xl bg-primary/10",
          className,
          initialsClassName,
        )}
        aria-label={resolvedAlt}
      >
        <img src={markLogo} alt={resolvedAlt} className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl", className)}>
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
