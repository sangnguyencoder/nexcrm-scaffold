import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  getAppErrorDetails,
  runAsyncAction,
  type AppErrorDetails,
} from "@/services/shared";

type AppMutationOptions<TData, TVariables, TOnMutateResult> = UseMutationOptions<
  TData,
  unknown,
  TVariables,
  TOnMutateResult
> & {
  errorMessage?: string;
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  action?: string;
  timeoutMs?: number;
};

export type AppMutationResult<TData, TVariables = void, TOnMutateResult = unknown> =
  UseMutationResult<TData, unknown, TVariables, TOnMutateResult> & {
    actionError: AppErrorDetails | null;
    clearActionError: () => void;
    retryLast: () => Promise<TData | undefined>;
    canRetry: boolean;
  };

export function useAppMutation<TData, TVariables = void, TOnMutateResult = unknown>({
  errorMessage,
  successMessage,
  action = "mutation",
  timeoutMs,
  onError,
  onMutate,
  onSettled,
  onSuccess,
  ...options
}: AppMutationOptions<TData, TVariables, TOnMutateResult>): AppMutationResult<
  TData,
  TVariables,
  TOnMutateResult
> {
  const [actionError, setActionError] = useState<AppErrorDetails | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const lastCallRef = useRef<{ called: boolean; variables: TVariables | undefined }>({
    called: false,
    variables: undefined,
  });

  const mutation = useMutation({
    ...options,
    mutationFn: async (variables: TVariables, mutationContext) => {
      const mutationFn = options.mutationFn;
      if (!mutationFn) {
        throw new Error("Thiếu mutationFn cho useAppMutation.");
      }

      return runAsyncAction(
        {
          scope: "mutation",
          action,
          timeoutMs,
          timeoutMessage: "Yêu cầu đang mất quá lâu để hoàn tất. Vui lòng thử lại.",
          meta:
            typeof variables === "object" && variables !== null
              ? { keys: Object.keys(variables as Record<string, unknown>) }
              : undefined,
        },
        (signal) =>
          mutationFn(
            variables,
            {
              ...mutationContext,
              signal,
            } as typeof mutationContext & { signal: AbortSignal },
          ),
      );
    },
    onMutate: async (variables, mutationContext) => {
      lastCallRef.current = { called: true, variables };
      setActionError(null);
      setCanRetry(false);
      return onMutate?.(variables, mutationContext);
    },
    onSuccess: async (data, variables, onMutateResult, mutationContext) => {
      setActionError(null);
      setCanRetry(false);
      if (successMessage) {
        toast.success(
          typeof successMessage === "function"
            ? successMessage(data, variables)
            : successMessage,
        );
      }
      await onSuccess?.(data, variables, onMutateResult as TOnMutateResult, mutationContext);
    },
    onError: (error, variables, onMutateResult, mutation) => {
      const details = getAppErrorDetails(error, errorMessage);
      setActionError(details);
      setCanRetry(Boolean(details.retryable && lastCallRef.current.called));
      toast.error(details.message);
      onError?.(error, variables, onMutateResult as TOnMutateResult, mutation);
    },
    onSettled: async (data, error, variables, onMutateResult, mutationContext) => {
      await onSettled?.(data, error, variables, onMutateResult as TOnMutateResult, mutationContext);
    },
  });

  return {
    ...mutation,
    actionError,
    clearActionError: () => setActionError(null),
    retryLast: async () => {
      if (!lastCallRef.current.called) {
        return undefined;
      }

      return mutation.mutateAsync(lastCallRef.current.variables as TVariables);
    },
    canRetry,
  } as AppMutationResult<TData, TVariables, TOnMutateResult>;
}
