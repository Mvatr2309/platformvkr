import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendMail } from "@/lib/mail";

const MAX_ACTIVE_APPLICATIONS = 5; // 05.04
const MAX_SUPERVISION_REQUESTS_PER_PROJECT = 3; // сколько НР можно предлагать один проект одновременно

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
      take: 500,
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
            user: { select: { name: true, email: true } },
          },
        },
        supervisor: {
          select: {
            id: true,
            workplace: true,
            position: true,
            academicDegree: true,
            expertise: true,
            user: { select: { name: true, email: true } },
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
      where: {
        projectId: { in: projectIds },
        type: { in: ["STUDENT", "SUPERVISOR"] },
      },
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
            user: { select: { name: true, email: true } },
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
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    return NextResponse.json(applications);
  }

  // Студент: as=proposals — мои предложения НР (SUPERVISION_REQUEST)
  if (session.user.role === "STUDENT" && asParam === "proposals") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json([]);

    const applications = await prisma.application.findMany({
      where: { studentId: student.id, type: "SUPERVISION_REQUEST" },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, title: true, status: true } },
        supervisor: {
          select: {
            id: true,
            contact: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    return NextResponse.json(applications);
  }

  // Студент: мои поданные заявки (STUDENT type only)
  if (session.user.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json([]);

    const applications = await prisma.application.findMany({
      where: { studentId: student.id, type: "STUDENT" },
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

    const supAs = request.nextUrl.searchParams.get("as");

    if (supAs === "my") {
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

    if (supAs === "proposals") {
      // Предложения проектов от студентов (SUPERVISION_REQUEST)
      const applications = await prisma.application.findMany({
        where: { supervisorId: supervisor.id, type: "SUPERVISION_REQUEST" },
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: {
              id: true, title: true, description: true, projectType: true,
              status: true, direction: true,
            },
          },
          student: {
            select: {
              id: true,
              direction: true,
              course: true,
              competencies: true,
              portfolioUrl: true,
              contact: true,
              user: { select: { name: true, email: true } },
            },
          },
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
            user: { select: { name: true, email: true } },
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
    const { projectId, motivation, role, supervisorId: targetSupervisorId, type: reqType } = await request.json();

    // ===== Предложение проекта НР (type: SUPERVISION_REQUEST) =====
    if (session.user.role === "STUDENT" && reqType === "SUPERVISION_REQUEST") {
      if (!targetSupervisorId || !projectId || !motivation) {
        return NextResponse.json(
          { error: "Выберите проект и напишите сообщение" },
          { status: 400 }
        );
      }

      const student = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!student) {
        return NextResponse.json({ error: "Сначала заполните профиль" }, { status: 400 });
      }

      // Проект должен быть авторским и без НР
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true, title: true, supervisorId: true, status: true,
          members: { where: { studentId: student.id, isCreator: true }, select: { id: true } },
        },
      });

      if (!project || project.members.length === 0) {
        return NextResponse.json({ error: "Вы можете предлагать только свои проекты" }, { status: 400 });
      }
      if (project.status !== "OPEN") {
        return NextResponse.json({ error: "Проект должен быть одобрен модерацией (статус «Открыт»), прежде чем предлагать его руководителю" }, { status: 400 });
      }
      if (project.supervisorId) {
        return NextResponse.json({ error: "У проекта уже есть научный руководитель" }, { status: 400 });
      }

      // НР существует и доступен
      const supervisor = await prisma.supervisorProfile.findUnique({
        where: { id: targetSupervisorId },
        select: {
          id: true, userId: true, status: true, recruitmentStatus: true, maxProjects: true,
          _count: { select: { projects: true } },
          user: { select: { name: true, email: true } },
        },
      });
      if (!supervisor || supervisor.status !== "APPROVED") {
        return NextResponse.json({ error: "Научный руководитель недоступен" }, { status: 400 });
      }
      if (supervisor.recruitmentStatus !== "OPEN") {
        return NextResponse.json({ error: "Научный руководитель не принимает новые проекты" }, { status: 400 });
      }
      if (supervisor._count.projects >= supervisor.maxProjects) {
        return NextResponse.json({ error: "У научного руководителя нет свободных слотов" }, { status: 400 });
      }

      // Дубликат: тот же проект тому же НР (ограничение БД @@unique([projectId, studentId, supervisorId])).
      const duplicate = await prisma.application.findFirst({
        where: { projectId, studentId: student.id, supervisorId: targetSupervisorId, type: "SUPERVISION_REQUEST" },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Вы уже отправили этот проект данному руководителю" }, { status: 409 });
      }

      // Лимит: скольким НР можно предлагать проект одновременно (активные предложения).
      const activeCount = await prisma.application.count({
        where: {
          projectId,
          studentId: student.id,
          type: "SUPERVISION_REQUEST",
          status: { in: ["PENDING", "INTERESTED", "AWAITING_STUDENT"] },
        },
      });
      if (activeCount >= MAX_SUPERVISION_REQUESTS_PER_PROJECT) {
        return NextResponse.json(
          { error: `Можно предложить проект не более чем ${MAX_SUPERVISION_REQUESTS_PER_PROJECT} руководителям одновременно. Отзовите одно из предложений в разделе «Мои предложения».` },
          { status: 409 }
        );
      }

      const application = await prisma.application.create({
        data: {
          type: "SUPERVISION_REQUEST",
          projectId,
          studentId: student.id,
          supervisorId: targetSupervisorId,
          motivation,
        },
      });

      await prisma.activity.create({
        data: {
          projectId,
          action: "Студент предложил проект научному руководителю",
          actorEmail: session.user.email,
        },
      });

      // Уведомление НР
      notify({
        userId: supervisor.userId,
        type: "APPLICATION_NEW",
        title: "Предложение проекта",
        message: `Студент ${session.user.name} предлагает вам руководство проектом «${project.title}»`,
        link: `/applications`,
      }).catch(() => {});

      // E-mail НР о новом предложении проекта
      if (supervisor.user?.email) {
        const platformUrl = process.env.NEXTAUTH_URL || "https://vkr-platform.ru";
        sendMail({
          to: supervisor.user.email,
          subject: `Вам предложили проект — ${project.title}`,
          html: `
            <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #003092;">Новое предложение проекта</h2>
              <p style="color: #333;">Уважаемый(ая) <strong>${supervisor.user.name || "научный руководитель"}</strong>,</p>
              <p style="color: #555;">Студент <strong>${session.user.name}</strong> предлагает вам руководство проектом «<strong>${project.title}</strong>».</p>
              <p style="color: #555;">Перейдите на платформу, чтобы ознакомиться с проектом и ответить.</p>
              <p><a href="${platformUrl}/applications"
                 style="display: inline-block; background: #E8375A; color: #fff; padding: 14px 28px; text-decoration: none; font-weight: 600;">
                Перейти к предложениям
              </a></p>
            </div>`,
        }).catch((err) => console.error("Failed to send supervision-request email:", err.message));
      }

      return NextResponse.json(application, { status: 201 });
    }

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
        select: { id: true, status: true, maxProjects: true, _count: { select: { projects: true } } },
      });

      if (!supervisor || supervisor.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Ваш профиль должен быть одобрен для подачи заявок" },
          { status: 400 }
        );
      }

      // Проверка лимита слотов
      if (supervisor._count.projects >= supervisor.maxProjects) {
        return NextResponse.json(
          { error: `Вы уже руководите максимальным количеством проектов (${supervisor.maxProjects})` },
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
      if (creator?.student) {
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
          title: "Заявка научного руководителя на проект",
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

    // Проверка дубликата (один отклик студента на проект)
    const existing = await prisma.application.findFirst({
      where: { projectId, studentId: student.id, type: "STUDENT" },
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

    // Исследование — формат 1 на 1.
    // Студент может откликнуться только на исследование, которое создал НР (есть руководитель)
    // и в котором ещё нет студента.
    if (project.projectType === "CLASSIC_DISSERTATION") {
      if (!project.supervisorId) {
        return NextResponse.json(
          { error: "На это исследование нельзя откликнуться — у него нет научного руководителя." },
          { status: 400 }
        );
      }
      if (project._count.members > 0) {
        return NextResponse.json(
          { error: "Это исследование уже занято студентом (формат 1 на 1)." },
          { status: 400 }
        );
      }
      // иначе — исследование НР без студента: отклик разрешён
    }

    // Проверка лимита команды для стартапов
    const isStartup = ["STARTUP", "CORPORATE_STARTUP"].includes(project.projectType);
    if (isStartup && project._count.members >= 3) {
      return NextResponse.json(
        { error: "Команда проекта уже укомплектована (максимум 3 участника)" },
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
    if (creator?.student && creator.student.userId !== session.user.id) {
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
  } catch (err) {
    console.error("Application POST error:", err);
    return NextResponse.json(
      { error: "Ошибка подачи заявки" },
      { status: 500 }
    );
  }
}
