import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUsersQuery, queryKeys } from "@/hooks/useNexcrmQueries";
import { formatRole, getDefaultAvatarUrl, getRoleBadgeColor } from "@/lib/utils";
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
      if (!isEdit && users.some((user) => user.email.toLowerCase() === value.email.toLowerCase())) {
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

  const mutation = useMutation({
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
      description="Quản lý thông tin và quyền truy cập cho thành viên hệ thống."
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input {...form.register("email")} autoComplete="email" />
        </Field>
        <Field label="Họ và tên" error={form.formState.errors.full_name?.message}>
          <Input {...form.register("full_name")} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Vai trò">
            <Select {...form.register("role")}>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="director">Director</option>
              <option value="sales">Sales</option>
              <option value="cskh">CSKH</option>
              <option value="marketing">Marketing</option>
            </Select>
          </Field>
          <Field label="Phòng ban" error={form.formState.errors.department?.message}>
            <Input {...form.register("department")} />
          </Field>
        </div>
        <Field label="Mật khẩu" error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete={isEdit ? "current-password" : "new-password"} {...form.register("password")} />
        </Field>
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-500">{error}</span> : null}
    </label>
  );
}

export function UserManagePage() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useUsersQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const toggleStatus = useMutation({
    mutationFn: profileService.toggleActive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      toast.success("Đã cập nhật trạng thái thành viên");
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: User["role"] }) =>
      profileService.update(id, { role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      toast.success("Đã cập nhật vai trò");
    },
  });

  const deleteUser = useMutation({
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

  if (isLoading) {
    return <PageLoader panels={1} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thành Viên"
        subtitle="Quản lý vai trò, trạng thái và phân quyền cho đội ngũ vận hành."
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

      <Card>
        <CardContent className="p-0">
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
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={user.full_name}
                        src={user.avatar_url || getDefaultAvatarUrl(user.role)}
                      />

                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
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
                      <span>{user.is_active ? "Active" : "Inactive"}</span>
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
        </CardContent>
      </Card>

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
