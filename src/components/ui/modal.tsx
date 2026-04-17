import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  bodyClassName?: string;
  hideHeader?: boolean;
  showCloseButton?: boolean;
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  footer,
  bodyClassName,
  hideHeader = false,
  showCloseButton = true,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-xl duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 data-[state=open]:zoom-in-95",
            className,
          )}
        >
          {hideHeader ? (
            <div className="sr-only">
              <Dialog.Title>{title}</Dialog.Title>
              {description ? <Dialog.Description>{description}</Dialog.Description> : null}
            </div>
          ) : (
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-border px-6 pb-4 pt-5">
              <div>
                <Dialog.Title className="text-base font-semibold text-foreground">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              {showCloseButton ? (
                <Dialog.Close
                  aria-label="Đóng hộp thoại"
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </Dialog.Close>
              ) : null}
            </div>
          )}
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-6", bodyClassName)}>{children}</div>
          {footer ? <div className="mt-1 flex items-center justify-end gap-2 border-t border-border px-6 pb-5 pt-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
