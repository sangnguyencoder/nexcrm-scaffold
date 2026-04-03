import { Loader2, LogIn } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDefaultLogoUrl } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, user, initialized } = useAuthStore();
  const { register, handleSubmit } = useForm<LoginForm>({
    defaultValues: {
      email: "demo@nexcrm.vn",
      password: "123456",
    },
  });

  useEffect(() => {
    if (initialized && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [initialized, navigate, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <div className="space-y-2 text-center">
            <img
              src={getDefaultLogoUrl()}
              alt="NexCRM Demo"
              className="mx-auto h-16 w-auto rounded-2xl border border-border bg-card p-2"
            />
            <div className="font-display text-4xl font-bold text-primary">NexCRM</div>
            <div className="text-sm text-muted-foreground">
              CRM hiện đại cho doanh nghiệp Việt Nam
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={handleSubmit(async (values) => {
              try {
                await login(values.email, values.password);
                navigate("/dashboard", { replace: true });
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Đăng nhập thất bại. Kiểm tra lại tài khoản Supabase.",
                );
              }
            })}
          >
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Email</span>
              <Input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="email@domain.vn"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Mật khẩu</span>
              <Input
                {...register("password")}
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
              />
            </label>
            <div className="rounded-2xl bg-primary/5 p-4 text-sm text-muted-foreground">
              Đăng nhập bằng tài khoản đã tạo trong Supabase Auth
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn className="size-4" />
                  Đăng nhập
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
