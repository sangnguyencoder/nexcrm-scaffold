import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SettingsRowProps = {
  title: string;
  description?: string;
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function SettingsRow({
  title,
  description,
  children,
  meta,
  className,
}: SettingsRowProps) {
  return (
    <div className={cn("settings-row", className)}>
      <div className="settings-row-content">
        <div className="settings-row-title">{title}</div>
        {description ? <div className="settings-row-description">{description}</div> : null}
        {meta}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
