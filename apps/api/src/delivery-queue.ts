import type { Prisma } from "@prisma/client";
export type DeliveryTopic =
  | "newArrivals"
  | "stockAlerts"
  | "inquiryAlerts"
  | "paymentReminders";
export async function queueDelivery(
  tx: Prisma.TransactionClient,
  input: {
    businessId: string | null;
    userId: string;
    topic: DeliveryTopic;
    key: string;
    title: string;
    body: string;
    href: string;
  },
) {
  const [preference, user] = await Promise.all([
    tx.notificationPreference.findUnique({ where: { userId: input.userId } }),
    tx.user.findUnique({
      where: { id: input.userId },
      select: { phone: true, disabled: true },
    }),
  ]);
  if (!preference || !preference[input.topic] || !user || user.disabled) return;
  const channels = [
    preference.sms ? "SMS" : "",
    preference.whatsapp ? "WHATSAPP" : "",
    preference.email && preference.emailAddress ? "EMAIL" : "",
  ].filter(Boolean);
  if (channels.length)
    await tx.notificationDelivery.createMany({
      data: channels.map((channel) => ({
        businessId: input.businessId,
        userId: input.userId,
        dedupeKey: `${input.key}:${channel}`,
        topic: input.topic,
        channel,
        recipient:
          channel === "EMAIL" ? preference.emailAddress : `91${user.phone}`,
        title: input.title,
        body: input.body,
        href: input.href,
      })),
      skipDuplicates: true,
    });
}

// Batch first-publication fanout so approval does not require queries per follower.
export async function queueArrivalDeliveries(
  tx: Prisma.TransactionClient,
  input: {
    businessId: string;
    productId: string;
    userIds: string[];
    title: string;
    body: string;
    href: string;
  },
) {
  const users = await tx.user.findMany({
    where: {
      id: { in: input.userIds },
      disabled: false,
      notificationPreference: { newArrivals: true },
    },
    include: { notificationPreference: true },
  });
  const data = users.flatMap((user) => {
    const p = user.notificationPreference!;
    return [
      p.sms ? "SMS" : "",
      p.whatsapp ? "WHATSAPP" : "",
      p.email && p.emailAddress ? "EMAIL" : "",
    ]
      .filter(Boolean)
      .map((channel) => ({
        businessId: input.businessId,
        userId: user.id,
        dedupeKey: `new:${input.productId}:${user.id}:${channel}`,
        topic: "newArrivals",
        channel,
        recipient: channel === "EMAIL" ? p.emailAddress : `91${user.phone}`,
        title: input.title,
        body: input.body,
        href: input.href,
      }));
  });
  if (data.length)
    await tx.notificationDelivery.createMany({ data, skipDuplicates: true });
}
