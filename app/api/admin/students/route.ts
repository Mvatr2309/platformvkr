import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generatePassword(length = 10) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

// GET /api/admin/students — список студентов
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      student: {
        select: {
          projects: {
            select: {
              role: true,
              isCreator: true,
              project: { select: { title: true } },
            },
          },
        },
      },
    },
  });

  const registeredStudents = students.map((s) => {
    const members = s.student?.projects || [];
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      createdAt: s.createdAt,
      inSystem: true,
      projectRoles: members.map((m) => ({
        role: m.isCreator ? "Автор" : m.role || "Участник",
        projectTitle: m.project.title,
      })),
    };
  });

  // Ручные участники (не в системе)
  const manualMembers = await prisma.projectMember.findMany({
    where: { inSystem: false, studentId: null },
    select: {
      id: true,
      manualName: true,
      manualEmail: true,
      manualDirection: true,
      role: true,
      inSystem: true,
      joinedAt: true,
      project: { select: { title: true } },
    },
  });

  const manualStudents = manualMembers.map((m) => ({
    id: `manual_${m.id}`,
    memberId: m.id,
    name: m.manualName || "—",
    email: m.manualEmail || "—",
    createdAt: m.joinedAt,
    inSystem: false,
    projectRoles: [{
      role: m.role || "Участник",
      projectTitle: m.project.title,
    }],
  }));

  return NextResponse.json([...registeredStudents, ...manualStudents]);
}

// PUT /api/admin/students — пригласить ручного участника (создать аккаунт + привязать)
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { memberId } = await request.json();
    if (!memberId) {
      return NextResponse.json({ error: "memberId обязателен" }, { status: 400 });
    }

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
      select: { manualName: true, manualEmail: true, manualDirection: true, inSystem: true },
    });

    if (!member || member.inSystem) {
      return NextResponse.json({ error: "Участник не найден или уже в системе" }, { status: 400 });
    }

    const email = member.manualEmail;
    if (!email) {
      return NextResponse.json({ error: "У участника не указан e-mail" }, { status: 400 });
    }

    // Проверяем, существует ли пользователь с таким email
    let user = await prisma.user.findUnique({ where: { email } });
    let generatedPassword: string | null = null;

    if (!user) {
      generatedPassword = generatePassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 12);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: member.manualName || "",
          role: "STUDENT",
          agreementAccepted: true,
        },
      });
    }

    // Создаём StudentProfile если нет
    let studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });
    if (!studentProfile) {
      studentProfile = await prisma.studentProfile.create({
        data: {
          userId: user.id,
          direction: member.manualDirection || "",
          course: 1,
          contact: email,
        },
      });
    }

    // Привязываем ProjectMember к StudentProfile
    await prisma.projectMember.update({
      where: { id: memberId },
      data: { studentId: studentProfile.id, inSystem: true },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      generatedPassword,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка приглашения" }, { status: 500 });
  }
}

// POST /api/admin/students — создать аккаунт студента
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "ФИО и e-mail обязательны" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким e-mail уже существует" },
        { status: 409 }
      );
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "STUDENT",
        agreementAccepted: true,
      },
    });

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email, generatedPassword: password },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Ошибка создания аккаунта" },
      { status: 500 }
    );
  }
}
