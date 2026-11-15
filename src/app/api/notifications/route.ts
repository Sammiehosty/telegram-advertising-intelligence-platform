import { NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser, isErrorResponse } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(25);
  const unread = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(sql`${notifications.userId} = ${user.id} and ${notifications.isRead} = false`);
  return NextResponse.json({ ok: true, notifications: rows, unread: unread[0]?.n ?? 0 });
}

export async function POST() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, user.id));
  return NextResponse.json({ ok: true });
}
