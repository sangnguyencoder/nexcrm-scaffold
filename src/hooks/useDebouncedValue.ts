import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = globalThis.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      globalThis.clearTimeout(handle);
    };
  }, [delayMs, value]);

  return debouncedValue;
}
