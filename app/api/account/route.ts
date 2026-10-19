import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const timezone = body?.timezone;
  if (typeof timezone !== "string" || timezone.length > 100)
    return Response.json({ error: "Invalid timezone" }, { status: 400 });
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    return Response.json({ error: "Invalid timezone" }, { status: 400 });
  }
  await prisma.user.upsert({
    where: { clerkUserId: userId },
    create: { clerkUserId: userId, preferredTimezone: timezone },
    update: { preferredTimezone: timezone },
  });
  return Response.json({ timezone });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { clerkUserId: userId },
      include: { connections: { select: { id: true, whoopUserId: true } } },
    });
    if (!user) return;
    const ids = user.connections.map((c) => c.id);
    await tx.dailyMetric.deleteMany({ where: { connectionId: { in: ids } } });
    await tx.auditEvent.deleteMany({ where: { connectionId: { in: ids } } });
    // Event payloads are shared when the same WHOOP member connected multiple accounts.
    for (const c of user.connections) {
      const others = await tx.whoopConnection.count({
        where: { whoopUserId: c.whoopUserId, userId: { not: user.id } },
      });
      if (!others)
        await tx.webhookEvent.deleteMany({
          where: { whoopUserId: c.whoopUserId },
        });
    }
    await tx.user.delete({ where: { id: user.id } });
  });
  await (
    await clerkClient()
  ).users.updateUserMetadata(userId, {
    privateMetadata: { whooperProfile: null },
  });
  return Response.json({ deleted: true });
}
