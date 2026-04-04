import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[app-error-boundary] uncaught render error", {
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    globalThis.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="font-display text-2xl font-bold">Ứng dụng vừa gặp lỗi ngoài dự kiến</div>
            <div className="text-sm text-muted-foreground">
              Phiên làm việc hiện tại đã được chặn an toàn để tránh làm hỏng dữ liệu đang thao tác.
            </div>
            <div className="flex justify-center">
              <Button onClick={this.handleReset}>Tải lại ứng dụng</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
