import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { InputField } from "@/components/auth/InputField";
import { SocialLogin } from "@/components/auth/SocialLogin";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="border-border/80 shadow-none">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="space-y-2">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:hidden">
            NexCRM Workspace
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-3xl font-bold text-foreground">Đăng nhập</h2>
            {/* <p className="text-sm leading-6 text-muted-foreground">
              Dùng email công việc hoặc username nội bộ để truy cập CRM.
            </p> */}
          </div>
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
              hint="Ưu tiên email công ty khi đăng nhập lần đầu hoặc cần khôi phục mật khẩu."
              {...register("identifier")}
            />

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
          </div>

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}
          {!submitError && resetFeedback ? (
            <div
              role="status"
              className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
            >
              {resetFeedback}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <label className="inline-flex items-center gap-3 text-sm text-muted-foreground">
              <Checkbox {...register("rememberMe")} className="rounded-md" />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={!isValid || isBusy}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
          Nếu bạn không vào được hệ thống sau nhiều lần thử, tài khoản có thể chưa được cấp quyền hoặc đang bị khóa.
        </div>
      </CardContent>
    </Card>
  );
}
