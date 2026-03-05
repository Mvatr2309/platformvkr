import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";

// GET /api/admin/matching — проекты без НР + доступные НР (04.01, 04.05)
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  // Проекты без руководителя или со статусом OPEN/PENDING
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { supervisorId: null },
        { status: { in: ["OPEN", "PENDING"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      supervisor: { select: { id: true, user: { select: { name: true } } } },
      _count: { select: { members: true } },
    },
  });

  // Доступные НР (04.05 — не предлагать с заполненными слотами)
  const supervisors = await prisma.supervisorProfile.findMany({
    where: { status: "APPROVED" },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { projects: true } },
    },
  });

  const available = supervisors.filter((s) => s._count.projects < s.maxSlots);

  return NextResponse.json({ projects, supervisors: available });
}

// POST /api/admin/matching — предложить НР на проект (04.02, 04.03)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { projectId, supervisorId } = await request.json();

  if (!projectId || !supervisorId) {
    return NextResponse.json({ error: "Укажите проект и руководителя" }, { status: 400 });
  }

  const supervisor = await prisma.supervisorProfile.findUnique({
    where: { id: supervisorId },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { projects: true } },
    },
  });

  if (!supervisor) {
    return NextResponse.json({ error: "Руководитель не найден" }, { status: 404 });
  }

  // 04.05 — проверка нагрузки
  if (supervisor._count.projects >= supervisor.maxSlots) {
    return NextResponse.json({ error: "У руководителя заполнены все слоты" }, { status: 400 });
  }

  // 04.03 — назначаем НР, но со статусом PENDING_SUPERVISOR (ожидает подтверждения)
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      supervisorId,
      assignmentStatus: "PENDING_SUPERVISOR",
    },
  });

  // Запись в активность
  await prisma.activity.create({
    data: {
      projectId,
      action: `Предложено руководство: ${supervisor.user.name} (ожидает подтверждения)`,
    },
  });

  // In-app уведомление НР
  notify({
    userId: supervisor.userId,
    type: "PROJECT_STATUS",
    title: "Предложение руководства проектом",
    message: `Вам предложено руководство проектом «${project.title}». Подтвердите или отклоните.`,
    link: `/projects/${project.id}`,
  }).catch(() => {});

  // 04.03 — email уведомление с предложением
  try {
    await sendMail({
      to: supervisor.user.email,
      subject: "Предложение руководства проектом — Платформа ВКР",
      html: `
        <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #003092;">Предложение руководства проектом</h2>
          <p style="color: #333;">Уважаемый(ая) <strong>${supervisor.user.name}</strong>,</p>
          <p style="color: #555;">Вам предложено руководство проектом «${project.title}». Пожалуйста, перейдите на платформу, чтобы подтвердить или отклонить назначение.</p>
          <p><a href="${process.env.NEXTAUTH_URL}/projects/${project.id}"
             style="display: inline-block; background: #E8375A; color: #fff; padding: 14px 28px; text-decoration: none; font-weight: 600;">
            Перейти к проекту
          </a></p>
        </div>
      `,
    });
  } catch {
    // Email не критичен
  }

  return NextResponse.json(project);
}
