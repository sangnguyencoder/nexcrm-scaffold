import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { getAppErrorMessage } from "@/services/shared";

type AppMutationOptions<TData, TVariables, TContext> = UseMutationOptions<
  TData,
  unknown,
  TVariables,
  TContext
> & {
  errorMessage?: string;
};

export function useAppMutation<TData, TVariables = void, TContext = unknown>({
  errorMessage,
  onError,
  ...options
}: AppMutationOptions<TData, TVariables, TContext>): UseMutationResult<
  TData,
  unknown,
  TVariables,
  TContext
> {
  return useMutation({
    ...options,
    onError: (error, variables, context, mutation) => {
      toast.error(getAppErrorMessage(error, errorMessage));
      onError?.(error, variables, context, mutation);
    },
  });
}
