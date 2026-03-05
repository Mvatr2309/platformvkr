import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/events/ical — экспорт событий в формате iCal (06.06)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const direction = searchParams.get("direction");

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (direction) where.direction = direction;

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "asc" },
    include: { project: { select: { title: true } } },
  });

  // Build iCal
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VKR Platform//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:ВКР ${direction || "все направления"}`,
  ];

  for (const event of events) {
    const dt = new Date(event.date);
    const dateStr = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const uid = `${event.id}@vkr-platform`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${dateStr}`);
    lines.push(`SUMMARY:${escapeIcal(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcal(event.description)}`);
    }
    if (event.project) {
      lines.push(`CATEGORIES:${escapeIcal(event.project.title)}`);
    }
    if (event.direction) {
      lines.push(`X-DIRECTION:${event.direction}`);
    }
    lines.push(`X-EVENT-TYPE:${event.eventType}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ical = lines.join("\r\n");

  return new NextResponse(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=vkr-events.ics",
    },
  });
}

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
