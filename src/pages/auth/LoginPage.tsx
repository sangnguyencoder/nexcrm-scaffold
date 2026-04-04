import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { PasswordRecoveryForm } from "@/components/auth/PasswordRecoveryForm";
import { useAuthStore } from "@/stores/authStore";

type LoginLocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    signInWithGoogle,
    requestPasswordReset,
    updatePassword,
    isLoading,
    user,
    initialized,
  } = useAuthStore();
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get("mode");
  const isRecoveryMode = mode === "recovery";
  const nextFromQuery = searchParams.get("next");
  const nextFromState = (location.state as LoginLocationState | null)?.from;

  const nextPath =
    (nextFromQuery && nextFromQuery.startsWith("/") && nextFromQuery) ||
    (nextFromState?.pathname
      ? `${nextFromState.pathname}${nextFromState.search ?? ""}${nextFromState.hash ?? ""}`
      : null) ||
    "/dashboard";

  useEffect(() => {
    if (!isRecoveryMode && initialized && user) {
      navigate(nextPath, { replace: true });
    }
  }, [initialized, isRecoveryMode, navigate, nextPath, user]);

  return (
    <AuthLayout>
      {isRecoveryMode ? (
        <PasswordRecoveryForm
          canReset={Boolean(user)}
          isSubmitting={isLoading}
          onSubmit={async (password) => {
            await updatePassword(password);
            navigate(nextPath, { replace: true });
          }}
          onBackToLogin={() => {
            navigate("/login", { replace: true });
          }}
        />
      ) : (
        <LoginForm
          isSubmitting={isLoading}
          onSubmit={async (values) => {
            await login(values.identifier, values.password, {
              rememberMe: values.rememberMe,
            });
            navigate(nextPath, { replace: true });
          }}
          onGoogleLogin={(rememberMe) => signInWithGoogle(nextPath, rememberMe)}
          onForgotPassword={requestPasswordReset}
        />
      )}
    </AuthLayout>
  );
}
