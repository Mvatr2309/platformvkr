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

  const result = students.map((s) => {
    const members = s.student?.projects || [];
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      createdAt: s.createdAt,
      projectRoles: members.map((m) => ({
        role: m.isCreator ? "Автор" : m.role || "Участник",
        projectTitle: m.project.title,
      })),
    };
  });

  return NextResponse.json(result);
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
