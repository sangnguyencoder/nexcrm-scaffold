import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, UserRound } from "lucide-react";

import { cn, formatRole, getDefaultAvatarUrl } from "@/lib/utils";
import type { User } from "@/types";

type UserSelectOption = {
  id: string;
  full_name: string;
  role: User["role"];
  avatar_url?: string | null;
};

function UserOption({
  option,
  compact = false,
}: {
  option: UserSelectOption;
  compact?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="inline-flex size-7 shrink-0 overflow-hidden rounded-full border border-border/70 bg-muted/70">
        <img
          src={option.avatar_url || getDefaultAvatarUrl(option.role)}
          alt={option.full_name}
          className="size-full object-cover"
          onError={(event) => {
            const target = event.currentTarget;
            const fallback = getDefaultAvatarUrl(option.role);
            if (!target.src.endsWith(fallback)) {
              target.src = fallback;
              return;
            }
            target.style.display = "none";
          }}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{option.full_name}</span>
        {!compact ? <span className="block truncate text-xs text-muted-foreground">{formatRole(option.role)}</span> : null}
      </span>
    </span>
  );
}

export function UserSelect({
  value,
  onValueChange,
  users,
  className,
  triggerClassName,
  contentClassName,
  placeholder = "Chọn người phụ trách",
  includeAllOption = false,
  allLabel = "Tất cả phụ trách",
  disabled,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  users: UserSelectOption[];
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: string;
  includeAllOption?: boolean;
  allLabel?: string;
  disabled?: boolean;
}) {
  const selected = users.find((user) => user.id === value);
  const allSelected = includeAllOption && value === "all";

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border/80 bg-card px-3 text-left shadow-xs transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60",
          triggerClassName,
          className,
        )}
      >
        {selected ? (
          <UserOption option={selected} compact />
        ) : allSelected ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <UserRound className="size-4 text-muted-foreground" />
            {allLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <UserRound className="size-4" />
            {placeholder}
          </span>
        )}
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn(
            "z-[70] min-w-[250px] overflow-hidden rounded-2xl border border-border/80 bg-popover p-1.5 shadow-soft",
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="max-h-[280px] p-0.5">
            {includeAllOption ? (
              <SelectPrimitive.Item
                value="all"
                className="relative flex min-h-10 cursor-pointer select-none items-center rounded-xl px-3.5 py-2 text-sm font-medium text-foreground outline-none transition data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"
              >
                <SelectPrimitive.ItemText>{allLabel}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center text-primary">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ) : null}

            {users.map((user) => (
              <SelectPrimitive.Item
                key={user.id}
                value={user.id}
                className="relative flex min-h-12 cursor-pointer select-none items-center rounded-xl px-2.5 py-1.5 outline-none transition data-[highlighted]:bg-primary/10"
              >
                <SelectPrimitive.ItemText asChild>
                  <UserOption option={user} />
                </SelectPrimitive.ItemText>
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
