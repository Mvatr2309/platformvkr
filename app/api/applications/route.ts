import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

const MAX_ACTIVE_APPLICATIONS = 5; // 05.04

// GET /api/applications — мои заявки (студент), заявки на мои проекты (НР/автор), модерация (админ)
// ?as=author — заявки на проекты где я автор (для студентов-авторов)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const asParam = request.nextUrl.searchParams.get("as");

  // Админ: все заявки (для обзора)
  if (session.user.role === "ADMIN") {
    const applications = await prisma.application.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, title: true } },
        student: {
          select: {
            id: true,
            direction: true,
            course: true,
            competencies: true,
            portfolioUrl: true,
            contact: true,
            user: { select: { name: true } },
          },
        },
        supervisor: {
          select: {
            id: true,
            workplace: true,
            position: true,
            academicDegree: true,
            expertise: true,
            user: { select: { name: true } },
          },
        },
      },
    });
    return NextResponse.json(applications);
  }

  // Студент-автор: заявки на мои проекты (где я автор) — включая заявки от НР
  if (session.user.role === "STUDENT" && asParam === "author") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json([]);

    // Найти проекты где студент — создатель (isCreator)
    const authorProjects = await prisma.projectMember.findMany({
      where: { studentId: student.id, isCreator: true },
      select: { projectId: true },
    });
    const projectIds = authorProjects.map((p) => p.projectId);
    if (projectIds.length === 0) return NextResponse.json([]);

    const applications = await prisma.application.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, title: true } },
        student: {
          select: {
            id: true,
            direction: true,
            course: true,
            competencies: true,
            portfolioUrl: true,
            contact: true,
            user: { select: { name: true } },
          },
        },
        supervisor: {
          select: {
            id: true,
            workplace: true,
            position: true,
            academicDegree: true,
            expertise: true,
            contact: true,
            user: { select: { name: true } },
          },
        },
      },
    });
    return NextResponse.json(applications);
  }

  // Студент: мои поданные заявки
  if (session.user.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json([]);

    const applications = await prisma.application.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, title: true, status: true } },
      },
    });
    return NextResponse.json(applications);
  }

  // НР: as=my — мои поданные заявки на руководство; иначе — входящие заявки студентов на мои проекты
  if (session.user.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisorProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!supervisor) return NextResponse.json([]);

    const asMy = request.nextUrl.searchParams.get("as") === "my";

    if (asMy) {
      // Мои заявки на руководство проектами
      const applications = await prisma.application.findMany({
        where: { supervisorId: supervisor.id, type: "SUPERVISOR" },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, title: true, status: true } },
        },
      });
      return NextResponse.json(applications);
    }

    // Входящие заявки студентов на мои проекты
    const applications = await prisma.application.findMany({
      where: { supervisorId: supervisor.id, type: "STUDENT" },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, title: true } },
        student: {
          select: {
            id: true,
            direction: true,
            course: true,
            competencies: true,
            portfolioUrl: true,
            contact: true,
            user: { select: { name: true } },
          },
        },
      },
    });
    return NextResponse.json(applications);
  }

  return NextResponse.json([]);
}

// POST /api/applications — подача заявки студентом (05.01) или НР (supervisor matching)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["STUDENT", "SUPERVISOR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const { projectId, motivation, role } = await request.json();

    if (!projectId || !motivation) {
      return NextResponse.json(
        { error: "Выберите проект и напишите мотивационное письмо" },
        { status: 400 }
      );
    }

    // ===== Заявка от НР (type: SUPERVISOR) =====
    if (session.user.role === "SUPERVISOR") {
      const supervisor = await prisma.supervisorProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true, status: true, maxSlots: true, _count: { select: { projects: true } } },
      });

      if (!supervisor || supervisor.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Ваш профиль должен быть одобрен для подачи заявок" },
          { status: 400 }
        );
      }

      // Проверка лимита слотов
      if (supervisor._count.projects >= supervisor.maxSlots) {
        return NextResponse.json(
          { error: `Вы уже руководите максимальным количеством проектов (${supervisor.maxSlots})` },
          { status: 400 }
        );
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, title: true, supervisorId: true, status: true },
      });

      if (!project || project.status !== "OPEN") {
        return NextResponse.json(
          { error: "Проект не найден или не принимает заявки" },
          { status: 400 }
        );
      }

      if (project.supervisorId) {
        return NextResponse.json(
          { error: "У проекта уже есть научный руководитель" },
          { status: 400 }
        );
      }

      // Проверка дубликата — НР уже подавал на этот проект
      const existing = await prisma.application.findFirst({
        where: { projectId, supervisorId: supervisor.id, type: "SUPERVISOR" },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Вы уже подали заявку на этот проект" },
          { status: 409 }
        );
      }

      const application = await prisma.application.create({
        data: {
          type: "SUPERVISOR",
          projectId,
          supervisorId: supervisor.id,
          motivation,
        },
      });

      // Лента активности
      await prisma.activity.create({
        data: {
          projectId,
          action: "Заявка от научного руководителя",
          actorEmail: session.user.email,
        },
      });

      // Уведомление создателю проекта (студенту)
      const creator = await prisma.projectMember.findFirst({
        where: { projectId, isCreator: true },
        select: { student: { select: { userId: true } } },
      });
      if (creator) {
        notify({
          userId: creator.student.userId,
          type: "APPLICATION_NEW",
          title: "Заявка от научного руководителя",
          message: `${session.user.name} хочет стать руководителем проекта «${project.title}»`,
          link: `/applications`,
        }).catch(() => {});
      }

      // Уведомление админам
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      for (const admin of admins) {
        notify({
          userId: admin.id,
          type: "APPLICATION_NEW",
          title: "Заявка НР на проект",
          message: `${session.user.name} подал заявку на руководство проектом «${project.title}»`,
          link: `/applications`,
        }).catch(() => {});
      }

      return NextResponse.json(application, { status: 201 });
    }

    // ===== Заявка от студента (type: STUDENT) =====
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Сначала заполните профиль студента" },
        { status: 400 }
      );
    }

    // 05.04 — ограничение на кол-во активных заявок
    const activeCount = await prisma.application.count({
      where: { studentId: student.id, status: "PENDING" },
    });

    if (activeCount >= MAX_ACTIVE_APPLICATIONS) {
      return NextResponse.json(
        { error: `Максимум ${MAX_ACTIVE_APPLICATIONS} активных заявок одновременно` },
        { status: 400 }
      );
    }

    // Проверка дубликата
    const existing = await prisma.application.findUnique({
      where: { projectId_studentId: { projectId, studentId: student.id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Вы уже подали заявку на этот проект" },
        { status: 409 }
      );
    }

    // Определяем НР проекта
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { supervisorId: true, status: true, projectType: true, _count: { select: { members: true } } },
    });

    if (!project || project.status !== "OPEN") {
      return NextResponse.json(
        { error: "Проект не найден или не принимает заявки" },
        { status: 400 }
      );
    }

    // Проверка лимита команды для стартапов
    const isStartup = ["STARTUP", "CORPORATE_STARTUP"].includes(project.projectType);
    if (isStartup && project._count.members >= 4) {
      return NextResponse.json(
        { error: "Команда проекта уже укомплектована (максимум 4 участника)" },
        { status: 400 }
      );
    }

    // Нельзя подавать заявку на свой проект
    const isMember = await prisma.projectMember.findFirst({
      where: { projectId, student: { userId: session.user.id } },
    });
    if (isMember) {
      return NextResponse.json(
        { error: "Вы уже являетесь участником этого проекта" },
        { status: 400 }
      );
    }

    const application = await prisma.application.create({
      data: {
        type: "STUDENT",
        projectId,
        studentId: student.id,
        supervisorId: project.supervisorId,
        motivation,
        role: role || null,
      },
    });

    // Запись в ленту активности
    await prisma.activity.create({
      data: {
        projectId,
        action: "Новая заявка от студента",
        actorEmail: session.user.email,
      },
    });

    // Уведомление создателю проекта о новой заявке
    const creator = await prisma.projectMember.findFirst({
      where: { projectId, isCreator: true },
      select: { student: { select: { userId: true } } },
    });
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true },
    });
    if (creator && creator.student.userId !== session.user.id) {
      notify({
        userId: creator.student.userId,
        type: "APPLICATION_NEW",
        title: "Новая заявка",
        message: `Студент ${session.user.name} подал заявку на проект «${proj?.title}»`,
        link: `/applications`,
      }).catch(() => {});
    }

    // Уведомление НР о новой заявке (если есть)
    if (project.supervisorId) {
      const sup = await prisma.supervisorProfile.findUnique({
        where: { id: project.supervisorId },
        select: { userId: true },
      });
      if (sup) {
        notify({
          userId: sup.userId,
          type: "APPLICATION_NEW",
          title: "Новая заявка",
          message: `Студент ${session.user.name} подал заявку на проект «${proj?.title}»`,
          link: `/applications`,
        }).catch(() => {});
      }
    }

    return NextResponse.json(application, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ошибка подачи заявки" },
      { status: 500 }
    );
  }
}
