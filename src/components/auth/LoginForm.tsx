import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { InputField } from "@/components/auth/InputField";
import { SocialLogin } from "@/components/auth/SocialLogin";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { getAuthErrorState } from "@/features/auth/auth-errors";
import {
  getDefaultRememberMeValue,
  persistRememberedLoginIdentifier,
  readRememberedLoginIdentifier,
} from "@/features/auth/login-prefs";
import {
  type LoginFormValues,
  loginSchema,
} from "@/features/auth/login-validation";

type LoginFormProps = {
  isSubmitting?: boolean;
  onSubmit: (values: LoginFormValues) => Promise<void>;
  onGoogleLogin: (rememberMe: boolean) => Promise<void>;
  onForgotPassword: (identifier: string) => Promise<string>;
};

export function LoginForm({
  isSubmitting = false,
  onSubmit,
  onGoogleLogin,
  onForgotPassword,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [isResetPending, setIsResetPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const resetRequestLockedRef = useRef(false);

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    setError,
    clearErrors,
    trigger,
    formState: { errors, isValid, dirtyFields },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      identifier: readRememberedLoginIdentifier(),
      password: "",
      rememberMe: getDefaultRememberMeValue(),
    },
  });

  const identifier = watch("identifier");
  const rememberMe = watch("rememberMe");

  useEffect(() => {
    if (submitError && (dirtyFields.identifier || dirtyFields.password)) {
      setSubmitError(null);
    }
    if (resetFeedback && (dirtyFields.identifier || dirtyFields.password)) {
      setResetFeedback(null);
    }
  }, [dirtyFields.identifier, dirtyFields.password, resetFeedback, submitError]);

  const isBusy = isSubmitting || isResetPending || isGooglePending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">Đăng nhập</h2>
        <p className="text-sm text-muted-foreground">Chào mừng trở lại.</p>
      </div>

      <SocialLogin
        disabled={isSubmitting || isResetPending}
        isLoading={isGooglePending}
        onGoogleLogin={async () => {
          setSubmitError(null);
          setIsGooglePending(true);

          try {
            persistRememberedLoginIdentifier(identifier, rememberMe);
            await onGoogleLogin(rememberMe);
          } catch (error) {
            setSubmitError(getAuthErrorState(error, "oauth").message);
            setIsGooglePending(false);
          }
        }}
      />

      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setSubmitError(null);
          setResetFeedback(null);
          clearErrors();

          try {
            persistRememberedLoginIdentifier(values.identifier, values.rememberMe);
            await onSubmit(values);
          } catch (error) {
            const authError = getAuthErrorState(error, "login");

            if (authError.field) {
              setError(authError.field, {
                type: "server",
                message: authError.message,
              });
              return;
            }

            setSubmitError(authError.message);
          }
        })}
      >
        <div className="space-y-4">
          <InputField
            label="Email hoặc username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="name@company.vn hoặc username"
            startAdornment={<Mail className="size-4" />}
            error={errors.identifier?.message}
            {...register("identifier")}
          />

          <div className="space-y-2">
            <InputField
              label="Mật khẩu"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              startAdornment={<KeyRound className="size-4" />}
              error={errors.password?.message}
              {...register("password")}
              endAdornment={
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    setShowPassword((value) => !value);
                  }}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-medium text-primary transition-colors hover:text-[rgb(var(--accent-hover-rgb)/1)]"
                onClick={async () => {
                  if (resetRequestLockedRef.current) {
                    return;
                  }

                  resetRequestLockedRef.current = true;
                  setIsResetPending(true);

                  try {
                    const isIdentifierValid = await trigger("identifier");
                    if (!isIdentifierValid) {
                      return;
                    }

                    setSubmitError(null);
                    setResetFeedback(null);
                    clearErrors("identifier");

                    const email = await onForgotPassword(getValues("identifier"));
                    setResetFeedback(`Đã gửi liên kết đặt lại mật khẩu đến ${email}.`);
                  } catch (error) {
                    const authError = getAuthErrorState(error, "password_reset");

                    if (authError.field) {
                      setError(authError.field, {
                        type: "server",
                        message: authError.message,
                      });
                    } else {
                      setSubmitError(authError.message);
                    }
                  } finally {
                    setIsResetPending(false);
                    resetRequestLockedRef.current = false;
                  }
                }}
                disabled={isBusy}
              >
                {isResetPending ? "Đang gửi..." : "Quên mật khẩu?"}
              </button>
            </div>
          </div>
        </div>

        {submitError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        ) : null}
        {!submitError && resetFeedback ? (
          <div
            role="status"
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
          >
            {resetFeedback}
          </div>
        ) : null}

        <label className="inline-flex items-center gap-3 text-sm text-muted-foreground">
          <Checkbox {...register("rememberMe")} className="rounded-md" />
          <span>Remember me</span>
        </label>

        <Button
          type="submit"
          size="lg"
          className="h-10 w-full"
          disabled={!isValid || isBusy}
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>

      <div className="pt-2 text-center text-[11px] text-muted-foreground">NexCRM v1.0</div>
    </div>
  );
}
