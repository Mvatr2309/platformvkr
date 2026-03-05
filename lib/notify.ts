import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/** Create an in-app notification for a user */
export async function notify(params: NotifyParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    },
  });
}

/** Create notifications for multiple users at once */
export async function notifyMany(
  userIds: string[],
  params: Omit<NotifyParams, "userId">
) {
  if (userIds.length === 0) return;
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    })),
  });
}
