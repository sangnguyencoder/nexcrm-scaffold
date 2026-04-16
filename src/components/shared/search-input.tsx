import { Search } from "lucide-react";
import { useEffect, useState, type InputHTMLAttributes } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value?: string;
  onChange?: (value: string) => void;
  onDebouncedChange?: (value: string) => void;
  delayMs?: number;
  wrapperClassName?: string;
};

export function SearchInput({
  value = "",
  onChange,
  onDebouncedChange,
  delayMs = 300,
  className,
  wrapperClassName,
  placeholder = "Tìm kiếm...",
  ...props
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const debouncedValue = useDebouncedValue(internalValue, delayMs);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    onDebouncedChange?.(debouncedValue);
  }, [debouncedValue, onDebouncedChange]);

  return (
    <div className={cn("relative min-w-[220px]", wrapperClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={internalValue}
        onChange={(event) => {
          const next = event.target.value;
          setInternalValue(next);
          onChange?.(next);
        }}
        placeholder={placeholder}
        className={cn("pl-9", className)}
        {...props}
      />
    </div>
  );
}
