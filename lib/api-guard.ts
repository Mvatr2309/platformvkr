import "server-only";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";

export type AuthedSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; role: UserRole; email: string };
};

const unauthorized = () =>
  NextResponse.json({ error: "Не авторизован" }, { status: 401 });
const forbidden = () =>
  NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

export function isGuardError(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requireAuth(): Promise<NextResponse | { session: AuthedSession }> {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return { session: session as AuthedSession };
}

export async function requireRole(
  ...roles: UserRole[]
): Promise<NextResponse | { session: AuthedSession }> {
  const result = await requireAuth();
  if (isGuardError(result)) return result;
  if (!roles.includes(result.session.user.role)) return forbidden();
  return result;
}

export const requireAdmin = () => requireRole(UserRole.ADMIN);

export type ProjectAccess = {
  session: AuthedSession;
  project: {
    id: string;
    supervisorUserId: string | null;
    isAdmin: boolean;
    isSupervisor: boolean;
    isCreator: boolean;
    isMember: boolean;
  };
};

export async function requireProjectAccess(
  projectId: string,
  opts: { write?: boolean } = {}
): Promise<NextResponse | ProjectAccess> {
  const result = await requireAuth();
  if (isGuardError(result)) return result;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      supervisor: { select: { userId: true } },
      members: {
        select: {
          isCreator: true,
          student: { select: { userId: true } },
        },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const userId = result.session.user.id;
  const role = result.session.user.role;
  const isAdmin = role === UserRole.ADMIN;
  const isSupervisor = project.supervisor?.userId === userId;
  const myMembership = project.members.find((m) => m.student?.userId === userId);
  const isCreator = myMembership?.isCreator === true;
  const isMember = Boolean(myMembership);

  const canRead = isAdmin || isSupervisor || isMember;
  const canWrite = isAdmin || isSupervisor || isCreator;

  if (!canRead) return forbidden();
  if (opts.write && !canWrite) return forbidden();

  return {
    session: result.session,
    project: {
      id: project.id,
      supervisorUserId: project.supervisor?.userId ?? null,
      isAdmin,
      isSupervisor,
      isCreator,
      isMember,
    },
  };
}
