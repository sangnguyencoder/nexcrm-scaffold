import { z } from "zod";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,64}$/;

export function normalizeLoginIdentifier(value: string) {
  return value.trim();
}

export function isLikelyEmailIdentifier(value: string) {
  return EMAIL_REGEX.test(normalizeLoginIdentifier(value).toLowerCase());
}

export function isValidLoginIdentifier(value: string) {
  const normalized = normalizeLoginIdentifier(value);

  if (!normalized || /\s/.test(normalized)) {
    return false;
  }

  return isLikelyEmailIdentifier(normalized) || USERNAME_REGEX.test(normalized);
}

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email hoặc username công việc.")
    .refine((value) => !/\s/.test(value), {
      message: "Email hoặc username không được chứa khoảng trắng.",
    })
    .refine((value) => isValidLoginIdentifier(value), {
      message: "Email hoặc username chưa đúng định dạng.",
    }),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu.")
    .min(6, "Mật khẩu cần ít nhất 6 ký tự."),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const passwordRecoverySchema = z
  .object({
    password: z
      .string()
      .min(1, "Vui lòng nhập mật khẩu mới.")
      .min(8, "Mật khẩu mới cần ít nhất 8 ký tự."),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận chưa khớp.",
  });

export type PasswordRecoveryValues = z.infer<typeof passwordRecoverySchema>;
