import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, channels, posts, discoveryJobs, scores, apiConfigurations, systemLogs } from "@/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/api";

/** GET /api/admin — system overview + user list. */
export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbOk = false;
  }

  const [userCount] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  const [chanCount] = await db.select({ n: sql<number>`count(*)::int` }).from(channels);
  const [postCount] = await db.select({ n: sql<number>`count(*)::int` }).from(posts);
  const [jobCount] = await db.select({ n: sql<number>`count(*)::int` }).from(discoveryJobs);
  const [scoreCount] = await db.select({ n: sql<number>`count(*)::int` }).from(scores);
  const [errorLogs] = await db.select({ n: sql<number>`count(*)::int` }).from(systemLogs).where(sql`level = 'error'`);

  const tg = await db.select().from(apiConfigurations).limit(1);
  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return NextResponse.json({
    ok: true,
    status: {
      database: dbOk ? "connected" : "error",
      // Honest service state: this deployment uses the built-in in-process job
      // runner instead of Redis/Celery.
      queue: "in-process runner (Redis/Celery optional on VPS — see docs)",
      telegram: tg[0]?.status ?? "not_configured",
      telegramUpdatedAt: tg[0]?.updatedAt ?? null,
    },
    stats: {
      users: userCount?.n ?? 0,
      channels: chanCount?.n ?? 0,
      posts: postCount?.n ?? 0,
      discoveryJobs: jobCount?.n ?? 0,
      analyses: scoreCount?.n ?? 0,
      errorLogs: errorLogs?.n ?? 0,
    },
    users: userRows,
  });
}
