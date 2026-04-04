import { Loader2 } from "lucide-react";

import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";

type SocialLoginProps = {
  disabled?: boolean;
  isLoading?: boolean;
  onGoogleLogin: () => Promise<void> | void;
};

export function SocialLogin({
  disabled = false,
  isLoading = false,
  onGoogleLogin,
}: SocialLoginProps) {
  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full justify-center border-border bg-background text-foreground shadow-none hover:bg-muted/70"
        onClick={() => {
          void onGoogleLogin();
        }}
        disabled={disabled || isLoading}
      >
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon className="size-4" />}
        Đăng nhập với Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/70" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Hoặc
          </span>
        </div>
      </div>
    </div>
  );
}
