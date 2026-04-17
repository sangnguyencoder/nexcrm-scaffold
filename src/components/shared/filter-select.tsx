import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  triggerClassName,
  contentClassName,
  disabled,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex h-11 w-full items-center justify-between gap-2 rounded-full border border-border/80 bg-card px-4 text-base font-medium text-foreground shadow-xs transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-muted-foreground sm:text-[13px]",
          triggerClassName,
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder ?? "Chọn"} />
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn(
            "z-50 min-w-[220px] overflow-hidden rounded-2xl border border-border/80 bg-popover p-1.5 shadow-soft",
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="p-0.5">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-10 cursor-pointer select-none items-center rounded-xl px-3.5 py-2 text-sm font-medium text-foreground outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center text-primary">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
