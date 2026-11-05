export interface UserRecord {
  id: string;
  name: string;
  role: "admin" | "user";
  email?: string;
  emailVerified: boolean;
  hasPassword: boolean;
}

export interface NewUser {
  name: string;
  email: string;
  password: string;
  role: UserRecord["role"];
}

export const ROLE_LABELS: Record<UserRecord["role"], string> = {
  admin: "Админ",
  user: "Пользователь",
};
