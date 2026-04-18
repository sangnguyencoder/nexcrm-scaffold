import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, UserCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionPanel } from "@/components/shared/section-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { useAppMutation } from "@/hooks/useAppMutation";
import { usePermission } from "@/hooks/usePermission";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUsersQuery, queryKeys } from "@/hooks/useNexcrmQueries";
import { getDefaultAvatarUrl, getRoleBadgeColor } from "@/lib/utils";
import { profileService } from "@/services/profileService";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";

const baseUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  full_name: z.string().min(1, "Vui lòng nhập họ tên"),
  role: z.enum(["super_admin", "admin", "sales", "cskh", "marketing", "director"]),
  department: z.string().min(1, "Vui lòng nhập phòng ban"),
  password: z.string(),
});

type UserFormValues = z.infer<typeof baseUserSchema>;

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
    confirmPassword: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp",
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const DEFAULT_MEMBER_PASSWORD = "12345678";

const ROLE_PERMISSION_REPORT: Array<{ role: string; summary: string }> = [
  { role: "super_admin", summary: "Full quyền toàn hệ thống (bypass toàn bộ)." },
  { role: "admin", summary: "Gần như full CRUD toàn hệ thống." },
  {
    role: "director",
    summary:
      "Chủ yếu quyền đọc + report:export + customer:delete + user:read/audit:read/posSync:read.",
  },
  {
    role: "sales",
    summary: "CRUD khách hàng, tạo/sửa giao dịch, tạo ticket, tạo/sửa deal, tạo/sửa task.",
  },
  {
    role: "cskh",
    summary: "Đọc khách hàng/giao dịch/ticket + tạo/sửa ticket + tạo/sửa task + đọc automation.",
  },
  {
    role: "marketing",
    summary: "Đọc báo cáo/khách hàng + tạo/sửa/gửi campaign + tạo/sửa automation.",
  },
];

function UserModal({
  open,
  onOpenChange,
  initialUser,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUser?: User | null;
}) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsersQuery();
  const isEdit = Boolean(initialUser);
  const formSchema = useMemo(
    () =>
      baseUserSchema.superRefine((value, ctx) => {
        const duplicatedUser = users.find(
          (user) =>
            user.email.toLowerCase() === value.email.toLowerCase() &&
            (!isEdit || user.id !== initialUser?.id),
        );

        if (duplicatedUser) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["email"],
            message: "Email đã tồn tại trong danh sách người dùng",
          });
        }

        const password = value.password.trim();
        if (!isEdit && password.length < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: "Mật khẩu tối thiểu 6 ký tự",
          });
        }

        if (isEdit && password.length > 0 && password.length < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: "Mật khẩu tối thiểu 6 ký tự",
          });
        }
      }),
    [initialUser?.id, isEdit, users],
  );
  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "sales",
      department: "",
      password: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: initialUser?.email ?? "",
        full_name: initialUser?.full_name ?? "",
        role: initialUser?.role ?? "sales",
        department: initialUser?.department ?? "",
        password: "",
      });
    }
  }, [form, initialUser, open]);

  const mutation = useAppMutation({
    action: isEdit ? "admin.user.update" : "admin.user.create",
    errorMessage: isEdit ? "Không thể cập nhật thành viên." : "Không thể thêm thành viên.",
    mutationFn: async (values: UserFormValues) => {
      if (isEdit && initialUser) {
        const updated = await profileService.update(initialUser.id, {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          department: values.department,
        });

        const nextPassword = values.password?.trim();
        if (nextPassword) {
          await profileService.resetPassword(initialUser.id, nextPassword);
        }

        return updated;
      }

      return profileService.create({
        email: values.email,
        full_name: values.full_name,
        role: values.role,
        department: values.department,
        password: values.password,
      });
    },
    onSuccess: (savedUser) => {
      queryClient.setQueryData<User[]>(queryKeys.profiles, (current = []) => {
        const existingIndex = current.findIndex((user) => user.id === savedUser.id);
        if (existingIndex === -1) {
          return [savedUser, ...current];
        }

        return current.map((user) => (user.id === savedUser.id ? savedUser : user));
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profiles,
        refetchType: "active",
      });
      toast.success(isEdit ? "Đã cập nhật thành viên" : "Đã thêm thành viên mới");
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Chỉnh sửa thành viên" : "Thêm Người Dùng"}
      // description="Quản lý thông tin và quyền truy cập cho thành viên hệ thống."
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        {mutation.actionError ? (
          <ActionErrorAlert
            error={mutation.actionError}
            onDismiss={mutation.clearActionError}
            onRetry={mutation.canRetry ? () => void mutation.retryLast() : undefined}
          />
        ) : null}
        <FormSection title="Thông tin truy cập" /* description="Giữ biểu mẫu ngắn, rõ, và đủ cho tác vụ quản trị hằng ngày." */>
          {isEdit ? <input type="hidden" {...form.register("email")} /> : null}
          {!isEdit ? (
            <FormField label="Email" error={form.formState.errors.email?.message}>
              <Input {...form.register("email")} autoComplete="email" />
            </FormField>
          ) : null}
          <FormField label="Họ và tên" error={form.formState.errors.full_name?.message}>
            <Input {...form.register("full_name")} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Vai trò">
              <Select {...form.register("role")}>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="director">Director</option>
                <option value="sales">Sales</option>
                <option value="cskh">CSKH</option>
                <option value="marketing">Marketing</option>
              </Select>
            </FormField>
            <FormField label="Phòng ban" error={form.formState.errors.department?.message}>
              <Input {...form.register("department")} />
            </FormField>
          </div>
          {!isEdit ? (
            <FormField
              label="Mật khẩu"
              error={form.formState.errors.password?.message}
            >
              <Input type="password" autoComplete="new-password" {...form.register("password")} />
            </FormField>
          ) : null}
        </FormSection>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm thành viên"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UserManagePage() {
  const queryClient = useQueryClient();
  const currentRole = useAuthStore((state) => state.role);
  const currentUserId = useAuthStore((state) => state.profile?.id ?? state.user?.id ?? null);
  const { canAccess } = usePermission();
  const canCreateUser = canAccess("user:create");
  const canUpdateUser = canAccess("user:update");
  const canDeleteUser = canAccess("user:delete");
  const { data: users = [], isLoading } = useUsersQuery();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<User["role"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<User | null>(null);
  const resetPasswordForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!resetPasswordTarget) return;

    resetPasswordForm.reset({
      password: "",
      confirmPassword: "",
    });
  }, [resetPasswordForm, resetPasswordTarget]);

  const toggleStatus = useAppMutation({
    action: "admin.user.toggle-status",
    errorMessage: "Không thể cập nhật trạng thái thành viên.",
    mutationFn: profileService.toggleActive,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<User[]>(queryKeys.profiles, (current = []) =>
        current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profiles,
        refetchType: "active",
      });
      toast.success("Đã cập nhật trạng thái thành viên");
    },
  });

  const updateRole = useAppMutation({
    action: "admin.user.update-role",
    errorMessage: "Không thể cập nhật vai trò.",
    mutationFn: ({ id, role }: { id: string; role: User["role"] }) =>
      profileService.update(id, { role }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<User[]>(queryKeys.profiles, (current = []) =>
        current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profiles,
        refetchType: "active",
      });
      toast.success("Đã cập nhật vai trò");
    },
  });

  const deleteUser = useAppMutation({
    action: "admin.user.account-lifecycle",
    errorMessage: "Không thể xử lý vòng đời tài khoản thành viên.",
    mutationFn: profileService.delete,
    onSuccess: (result) => {
      queryClient.setQueryData<User[]>(queryKeys.profiles, (current = []) => {
        if (result.outcome === "deactivated") {
          return current.map((user) =>
            user.id === result.user.id ? result.user : user,
          );
        }

        return current.filter((user) => user.id !== result.user.id);
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profiles,
        refetchType: "active",
      });
      toast.success(
        result.outcome === "deactivated"
          ? "Tài khoản đã được vô hiệu hóa vì còn dữ liệu liên kết"
          : "Đã xóa tài khoản thành viên",
      );
    },
  });

  const resetPassword = useAppMutation({
    action: "admin.user.reset-password",
    errorMessage: "Không thể đặt lại mật khẩu thành viên.",
    mutationFn: ({ id, password }: { id: string; password: string; fullName: string }) =>
      profileService.resetPassword(id, password),
    successMessage: (_, variables) => `Đã đặt lại mật khẩu cho ${variables.fullName}`,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profiles,
        refetchType: "active",
      });
      setResetPasswordTarget(null);
      resetPasswordForm.reset({
        password: "",
        confirmPassword: "",
      });
    },
  });

  const roleUpdatingUserId = updateRole.isPending ? (updateRole.variables?.id ?? null) : null;
  const togglingUserId = toggleStatus.isPending ? (toggleStatus.variables ?? null) : null;
  const deletingUserId = deleteUser.isPending ? (deleteUser.variables ?? null) : null;
  const resettingUserId = resetPassword.isPending ? (resetPassword.variables?.id ?? null) : null;

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (roleFilter !== "all" && user.role !== roleFilter) {
          return false;
        }

        if (statusFilter !== "all" && (statusFilter === "active") !== user.is_active) {
          return false;
        }

        if (search.trim()) {
          const keyword = search.toLowerCase();
          const haystack = `${user.full_name} ${user.email} ${user.department}`.toLowerCase();
          if (!haystack.includes(keyword)) {
            return false;
          }
        }

        return true;
      }),
    [roleFilter, search, statusFilter, users],
  );

  if (isLoading) {
    return <PageLoader panels={1} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thành Viên"
        // subtitle="Quản trị quyền truy cập, trạng thái hoạt động và phân bổ vai trò trên một bảng compact."
        actions={
          <>
            <StatusBadge
              label={`${users.length} thành viên`}
              className="bg-primary/10 text-primary ring-primary/20"
              dotClassName="bg-primary"
            />
            {canCreateUser ? (
              <Button
                onClick={() => {
                  setEditingUser(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="size-4" />
                Thêm Người Dùng
              </Button>
            ) : null}
          </>
        }
      />

      <StickyFilterBar>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên, email hoặc phòng ban"
          className="min-w-[260px] flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as User["role"] | "all")}
          className="w-[170px]"
        >
          <option value="all">Tất cả vai trò</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="director">Director</option>
          <option value="sales">Sales</option>
          <option value="cskh">CSKH</option>
          <option value="marketing">Marketing</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
          className="w-[160px]"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã khóa</option>
        </Select>
        <Badge className="bg-muted text-muted-foreground ring-border">{filteredUsers.length} hiển thị</Badge>
      </StickyFilterBar>

      <DataTableShell stickyHeader>
        {filteredUsers.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người Dùng</TableHead>
                <TableHead>Vai Trò</TableHead>
                <TableHead>Phòng Ban</TableHead>
                <TableHead>Trạng Thái</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={user.full_name}
                        src={user.avatar_url || getDefaultAvatarUrl(user.role)}
                      />

                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        {user.has_profile === false ? (
                          <div className="mt-1 text-xs text-amber-600">
                            Hồ sơ profile chưa hoàn thiện
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      disabled={
                        !canUpdateUser ||
                        user.has_profile === false ||
                        roleUpdatingUserId === user.id
                      }
                      onChange={(event) => {
                        if (!canUpdateUser) {
                          return;
                        }
                        const nextRole = event.target.value as User["role"];
                        if (currentUserId === user.id && user.role === "super_admin" && nextRole !== "super_admin") {
                          toast.error("Super Admin không thể tự hạ quyền của chính mình.");
                          return;
                        }
                        updateRole.mutate({ id: user.id, role: nextRole });
                      }}
                      className={getRoleBadgeColor(user.role)}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="director">Director</option>
                      <option value="sales">Sales</option>
                      <option value="cskh">CSKH</option>
                      <option value="marketing">Marketing</option>
                    </Select>
                  </TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>
                    <label className="flex items-center gap-3">
                      <Switch
                        checked={user.is_active}
                        disabled={
                          !canUpdateUser ||
                          user.has_profile === false ||
                          togglingUserId === user.id ||
                          currentUserId === user.id
                        }
                        onChange={() => toggleStatus.mutate(user.id)}
                      />
                      <span className="text-sm">{user.is_active ? "Đang hoạt động" : "Đã khóa"}</span>
                    </label>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canUpdateUser ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingUser(user);
                              setModalOpen(true);
                            }}
                            disabled={user.has_profile === false}
                          >
                            <UserCog className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setResetPasswordTarget(user)}
                            disabled={resettingUserId === user.id}
                          >
                            <KeyRound className="size-4" />
                          </Button>
                        </>
                      ) : null}
                      {canDeleteUser ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={user.has_profile === false || deletingUserId === user.id || currentUserId === user.id}
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="size-4 text-rose-500" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={UserCog}
              title="Không có thành viên phù hợp"
              description="Thử đổi bộ lọc vai trò hoặc trạng thái để xem các tài khoản khác."
              className="min-h-[200px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )}
      </DataTableShell>

      <SectionPanel
        title="Báo Cáo Quyền Theo Role"
        contentClassName="space-y-4"
      >
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          Đây là báo cáo quyền theo role đang khai báo để thay cho phần phân quyền thao tác theo nhân viên.
          Hệ thống đã áp dụng phân quyền theo báo cáo này để điều khiển hiển thị thao tác trong UI.
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {ROLE_PERMISSION_REPORT.map((item) => (
            <div
              key={item.role}
              className="rounded-xl border border-border/80 bg-card px-3 py-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{item.role}</div>
                {currentRole === item.role ? (
                  <StatusBadge
                    label="Role hiện tại"
                    className="bg-primary/10 text-primary ring-primary/20"
                    dotClassName="bg-primary"
                  />
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">{item.summary}</div>
            </div>
          ))}
        </div>
      </SectionPanel>

      <UserModal open={modalOpen} onOpenChange={setModalOpen} initialUser={editingUser} />

      <Modal
        open={Boolean(resetPasswordTarget) && canUpdateUser}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordTarget(null);
            resetPasswordForm.reset({
              password: "",
              confirmPassword: "",
            });
          }
        }}
        title={`Đặt lại mật khẩu${resetPasswordTarget ? `: ${resetPasswordTarget.full_name}` : ""}`}
      >
        <form
          className="space-y-4"
          onSubmit={resetPasswordForm.handleSubmit((values) => {
            if (!resetPasswordTarget || !canUpdateUser) return;
            resetPassword.mutate({
              id: resetPasswordTarget.id,
              password: values.password,
              fullName: resetPasswordTarget.full_name,
            });
          })}
        >
          {resetPassword.actionError ? (
            <ActionErrorAlert
              error={resetPassword.actionError}
              onDismiss={resetPassword.clearActionError}
              onRetry={resetPassword.canRetry ? () => void resetPassword.retryLast() : undefined}
            />
          ) : null}
          <FormSection title="Mật khẩu tạm thời">
            <FormField
              label="Mật khẩu mới"
              error={resetPasswordForm.formState.errors.password?.message}
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...resetPasswordForm.register("password")}
              />
            </FormField>
            <FormField
              label="Xác nhận mật khẩu"
              error={resetPasswordForm.formState.errors.confirmPassword?.message}
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...resetPasswordForm.register("confirmPassword")}
              />
            </FormField>
          </FormSection>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Mật khẩu mặc định của hệ thống hiện tại: <span className="font-semibold text-foreground">{DEFAULT_MEMBER_PASSWORD}</span>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={resetPassword.isPending || !resetPasswordTarget || !canUpdateUser}
              onClick={() => {
                if (!resetPasswordTarget || !canUpdateUser) return;
                resetPassword.mutate({
                  id: resetPasswordTarget.id,
                  password: DEFAULT_MEMBER_PASSWORD,
                  fullName: resetPasswordTarget.full_name,
                });
              }}
            >
              Đặt về mặc định
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setResetPasswordTarget(null);
                resetPasswordForm.reset({
                  password: "",
                  confirmPassword: "",
                });
              }}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={resetPassword.isPending || !canUpdateUser}>
              {resetPassword.isPending ? "Đang đặt lại..." : "Xác nhận đặt lại"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget) && canDeleteUser}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Gỡ tài khoản ${deleteTarget?.full_name ?? ""}?`}
        description="Hệ thống sẽ thử xóa tài khoản khỏi Auth. Nếu tài khoản còn liên kết dữ liệu CRM, hệ thống sẽ tự chuyển sang vô hiệu hóa để giữ toàn vẹn dữ liệu."
        confirmLabel="Xác nhận"
        onConfirm={() => {
          if (deleteTarget && canDeleteUser) {
            deleteUser.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
