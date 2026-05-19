export const UserRole = {
  ADMIN: "ADMIN",
  SUPERVISOR: "SUPERVISOR",
  STUDENT: "STUDENT",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ROLE_VALUES: readonly UserRole[] = Object.values(UserRole);

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ROLE_VALUES as readonly string[]).includes(value);
}
