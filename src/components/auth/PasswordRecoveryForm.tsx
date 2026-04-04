import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { InputField } from "@/components/auth/InputField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAppErrorMessage } from "@/services/shared";
import {
  type PasswordRecoveryValues,
  passwordRecoverySchema,
} from "@/features/auth/login-validation";

type PasswordRecoveryFormProps = {
  canReset: boolean;
  isSubmitting?: boolean;
  onSubmit: (password: string) => Promise<void>;
  onBackToLogin: () => void;
};

export function PasswordRecoveryForm({
  canReset,
  isSubmitting = false,
  onSubmit,
  onBackToLogin,
}: PasswordRecoveryFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<PasswordRecoveryValues>({
    resolver: zodResolver(passwordRecoverySchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  return (
    <Card className="border-border/80 shadow-none">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="space-y-1">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Password recovery
          </div>
          <h2 className="font-display text-3xl font-bold text-foreground">Đặt lại mật khẩu</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Tạo mật khẩu mới để tiếp tục truy cập CRM an toàn.
          </p>
        </div>

        {!canReset ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>Liên kết khôi phục không hợp lệ hoặc đã hết hạn. Hãy quay lại màn hình đăng nhập để yêu cầu email mới.</span>
          </div>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        ) : null}

        <form
          className="space-y-5"
          onSubmit={handleSubmit(async (values) => {
            setSubmitError(null);

            try {
              await onSubmit(values.password);
            } catch (error) {
              setSubmitError(getAppErrorMessage(error, "Không thể cập nhật mật khẩu mới."));
            }
          })}
        >
          <div className="space-y-4">
            <InputField
              label="Mật khẩu mới"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
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
                  aria-label={showPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            <InputField
              label="Xác nhận mật khẩu mới"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              startAdornment={<KeyRound className="size-4" />}
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
              endAdornment={
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    setShowConfirmPassword((value) => !value);
                  }}
                  aria-label={
                    showConfirmPassword ? "Ẩn xác nhận mật khẩu mới" : "Hiện xác nhận mật khẩu mới"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              }
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={!canReset || !isValid || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSubmitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
          </Button>
        </form>

        <button
          type="button"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={onBackToLogin}
        >
          Quay lại đăng nhập
        </button>
      </CardContent>
    </Card>
  );
}
