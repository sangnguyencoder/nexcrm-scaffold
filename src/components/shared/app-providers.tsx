import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

import { useAuthStore } from "@/stores/authStore";

type Props = {
  children: ReactNode;
};

function AuthBootstrap() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return null;
}

function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      duration={4800}
      closeButton={false}
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-border/80 bg-card text-card-foreground shadow-panel",
          default: "border-border/80 bg-card text-card-foreground",
          success: "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-100",
          error: "border-rose-500/25 bg-rose-500/12 text-rose-700 dark:text-rose-100",
          warning: "border-amber-500/25 bg-amber-500/12 text-amber-800 dark:text-amber-100",
          info: "border-indigo-500/25 bg-indigo-500/12 text-indigo-700 dark:text-indigo-100",
          title: "font-semibold text-sm",
          description: "text-sm opacity-80",
          actionButton: "rounded-md border border-border/80 bg-background px-3 text-foreground",
          cancelButton: "rounded-md border border-border/80 bg-background px-3 text-muted-foreground",
        },
      }}
    />
  );
}

export function AppProviders({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 180_000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap />
        {children}
        <AppToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
