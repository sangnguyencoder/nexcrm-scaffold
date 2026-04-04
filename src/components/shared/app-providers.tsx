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
          toast: "rounded-xl border border-border/80 bg-card text-card-foreground shadow-panel",
          default: "border-border/80 bg-card text-card-foreground",
          success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
          error: "border-rose-500/20 bg-rose-500/10 text-rose-900 dark:text-rose-100",
          warning: "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-100",
          info: "border-primary/20 bg-primary/10 text-foreground",
          title: "font-semibold text-sm",
          description: "text-sm opacity-80",
          actionButton: "rounded-lg border border-border/80 bg-background px-3 text-foreground",
          cancelButton: "rounded-lg border border-border/80 bg-background px-3 text-muted-foreground",
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
            staleTime: 120_000,
            gcTime: 600_000,
            retry: 0,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap />
        {children}
        <AppToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
