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
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { useAppMutation } from "@/hooks/useAppMutation";
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
import type { User } from "@/types";

const addUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  full_name: z.string().min(1, "Vui lòng nhập họ tên"),
  role: z.enum(["super_admin", "admin", "sales", "cskh", "marketing", "director"]),
  department: z.string().min(1, "Vui lòng nhập phòng ban"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

type AddUserValues = z.infer<typeof addUserSchema>;

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
  const form = useForm<AddUserValues>({
    resolver: zodResolver(addUserSchema.superRefine((value, ctx) => {
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
    })),
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
        password: "******",
      });
    }
  }, [form, initialUser, open]);

  const mutation = useAppMutation({
    action: isEdit ? "admin.user.update" : "admin.user.create",
    errorMessage: isEdit ? "Không thể cập nhật thành viên." : "Không thể thêm thành viên.",
    mutationFn: (values: AddUserValues) => {
      if (isEdit && initialUser) {
        return profileService.update(initialUser.id, {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          department: values.department,
        });
      }
      return profileService.create(values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
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
          <FormField label="Email" error={form.formState.errors.email?.message}>
            <Input {...form.register("email")} autoComplete="email" />
          </FormField>
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
          <FormField label="Mật khẩu" error={form.formState.errors.password?.message}>
            <Input type="password" autoComplete={isEdit ? "current-password" : "new-password"} {...form.register("password")} />
          </FormField>
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
  const { data: users = [], isLoading } = useUsersQuery();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<User["role"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const toggleStatus = useAppMutation({
    action: "admin.user.toggle-status",
    errorMessage: "Không thể cập nhật trạng thái thành viên.",
    mutationFn: profileService.toggleActive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      toast.success("Đã cập nhật trạng thái thành viên");
    },
  });

  const updateRole = useAppMutation({
    action: "admin.user.update-role",
    errorMessage: "Không thể cập nhật vai trò.",
    mutationFn: ({ id, role }: { id: string; role: User["role"] }) =>
      profileService.update(id, { role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      toast.success("Đã cập nhật vai trò");
    },
  });

  const deleteUser = useAppMutation({
    action: "admin.user.delete",
    errorMessage: "Không thể xóa thành viên.",
    mutationFn: profileService.delete,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      toast.success(
        result.softDeleted
          ? "Thành viên đã được vô hiệu hóa vì còn dữ liệu liên quan"
          : "Đã xóa thành viên",
      );
    },
  });

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
            <Button
              onClick={() => {
                setEditingUser(null);
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" />
              Thêm Người Dùng
            </Button>
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

      <DataTableShell>
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
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onChange={(event) => updateRole.mutate({ id: user.id, role: event.target.value as User["role"] })}
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
                      <Switch checked={user.is_active} onChange={() => toggleStatus.mutate(user.id)} />
                      <span className="text-sm">{user.is_active ? "Active" : "Inactive"}</span>
                    </label>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingUser(user);
                          setModalOpen(true);
                        }}
                      >
                        <UserCog className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toast.success(`Đã đặt lại mật khẩu cho ${user.full_name}`)}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(user)}>
                        <Trash2 className="size-4 text-rose-500" />
                      </Button>
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

      <UserModal open={modalOpen} onOpenChange={setModalOpen} initialUser={editingUser} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Xóa người dùng ${deleteTarget?.full_name ?? ""}?`}
        description="Tài khoản này sẽ bị xóa khỏi dữ liệu demo."
        confirmLabel="Xóa"
        onConfirm={() => {
          if (deleteTarget) {
            deleteUser.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
