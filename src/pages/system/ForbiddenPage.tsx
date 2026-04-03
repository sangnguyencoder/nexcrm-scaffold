import { ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/shared/empty-state";

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={ShieldOff}
      title="403 - Không đủ quyền truy cập"
      description="Vai trò hiện tại của bạn không được phép truy cập khu vực này."
      actionLabel="Quay lại Dashboard"
      onAction={() => navigate("/dashboard")}
    />
  );
}
