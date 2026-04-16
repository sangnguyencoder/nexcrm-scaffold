import { getAppErrorDetails } from "@/services/shared";

export type AuthErrorField = "identifier" | "password";
export type AuthAction = "login" | "password_reset" | "oauth";

export type AuthErrorState = {
  message: string;
  field?: AuthErrorField;
};

function stringifyError(error: unknown) {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  if (typeof error === "object") {
    return Object.values(error)
      .map((value) => String(value ?? ""))
      .join(" ")
      .toLowerCase();
  }

  return String(error).toLowerCase();
}

export function getAuthErrorState(
  error: unknown,
  action: AuthAction = "login",
): AuthErrorState {
  const details = getAppErrorDetails(error, "Không thể hoàn tất xác thực. Vui lòng thử lại.");
  const raw = stringifyError(error);

  if (details.kind === "network") {
    return {
      message: "Không thể kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.",
    };
  }

  if (details.kind === "timeout") {
    return {
      message: "Máy chủ phản hồi quá chậm. Vui lòng thử lại sau ít phút.",
    };
  }

  if (
    raw.includes("too many requests") ||
    raw.includes("rate limit") ||
    raw.includes("over_request_rate_limit")
  ) {
    return {
      message:
        action === "password_reset"
          ? "Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng chờ ít phút rồi thử lại."
          : "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.",
      field: action === "password_reset" ? "identifier" : "password",
    };
  }

  if (
    raw.includes("lock:sb-") ||
    raw.includes("stole it") ||
    raw.includes("auth token lock")
  ) {
    return {
      message:
        action === "password_reset"
          ? "Liên kết khôi phục vừa được xử lý ở phiên khác. Vui lòng thử lại sau vài giây."
          : "Phiên đăng nhập đang đồng bộ. Vui lòng thử lại sau vài giây.",
    };
  }

  if (
    raw.includes("bị khóa") ||
    raw.includes("đã bị khóa") ||
    raw.includes("account locked") ||
    raw.includes("user is banned") ||
    raw.includes("inactive")
  ) {
    return {
      message: "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.",
      field: "identifier",
    };
  }

  if (
    raw.includes("chưa có hồ sơ") ||
    raw.includes("chưa được cấp quyền") ||
    raw.includes("profile")
  ) {
    return {
      message: "Tài khoản chưa được cấp quyền truy cập CRM. Vui lòng liên hệ quản trị viên.",
      field: "identifier",
    };
  }

  if (raw.includes("email not confirmed")) {
    return {
      message: "Email này chưa được xác minh. Vui lòng kiểm tra hộp thư hoặc liên hệ quản trị viên.",
      field: "identifier",
    };
  }

  if (
    raw.includes("provider is not enabled") ||
    raw.includes("unsupported provider") ||
    raw.includes("oauth")
  ) {
    return {
      message: "Đăng nhập Google chưa được cấu hình trên môi trường này.",
    };
  }

  if (
    raw.includes("invalid login credentials") ||
    raw.includes("invalid grant") ||
    raw.includes("email or password") ||
    raw.includes("sai mật khẩu") ||
    raw.includes("không tồn tại")
  ) {
    return {
      message: "Email hoặc username, mật khẩu không chính xác.",
      field: "password",
    };
  }

  if (action === "password_reset" && details.kind === "validation") {
    return {
      message:
        details.message || "Nhập email công việc hợp lệ để nhận liên kết đặt lại mật khẩu.",
      field: "identifier",
    };
  }

  return {
    message: details.message,
  };
}
