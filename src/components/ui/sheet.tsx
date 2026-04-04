import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  bodyClassName?: string;
};

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  footer,
  bodyClassName,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-[min(100vw,560px)] flex-col border-l border-border bg-card shadow-soft",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-4 lg:px-5">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm leading-5 text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Đóng ngăn chi tiết"
              className="rounded-lg border border-transparent p-2 text-muted-foreground transition hover:border-border/70 hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-4 lg:p-5", bodyClassName)}>{children}</div>
          {footer ? <div className="border-t border-border/70 px-4 py-4 lg:px-5">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
