import type { User } from "@/types";

export const MOCK_USERS: User[] = [
  {
    id: "u1",
    full_name: "Nguyễn Văn Sáng",
    email: "sang@nexcrm.vn",
    role: "admin",
    department: "Quản trị",
    is_active: true,
    avatar_url: null,
  },
  {
    id: "u2",
    full_name: "Phạm Thị Nhung",
    email: "nhung@nexcrm.vn",
    role: "sales",
    department: "Kinh Doanh",
    is_active: true,
    avatar_url: null,
  },
  {
    id: "u3",
    full_name: "Nguyễn Thị Khánh Hòa",
    email: "hoa@nexcrm.vn",
    role: "cskh",
    department: "CSKH",
    is_active: true,
    avatar_url: null,
  },
  {
    id: "u4",
    full_name: "Hà Quang Tiến",
    email: "tien@nexcrm.vn",
    role: "marketing",
    department: "Marketing",
    is_active: true,
    avatar_url: null,
  },
  {
    id: "u5",
    full_name: "Vũ Trọng Tuyền",
    email: "tuyen@nexcrm.vn",
    role: "director",
    department: "Ban Lãnh Đạo",
    is_active: true,
    avatar_url: null,
  },
];
