import { NextResponse } from "next/server";
import { desc, asc, ilike, eq, and, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { channels, scores } from "@/db/schema";
import { requireUser, isErrorResponse } from "@/lib/api";

/** GET /api/channels?query=&category=&sort=&page= — channel database. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const sort = url.searchParams.get("sort") ?? "adScore";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 12;

  const conds: SQL[] = [];
  if (query) conds.push(ilike(channels.username, `%${query}%`));
  if (category) conds.push(eq(channels.category, category));
  const where = conds.length ? and(...conds) : undefined;

  const order =
    sort === "subscribers" ? desc(channels.subscribers)
    : sort === "avgViews" ? desc(scores.avgViews)
    : sort === "engagement" ? desc(scores.engagementRate)
    : sort === "quality" ? desc(scores.qualityScore)
    : sort === "recent" ? desc(scores.lastActiveAt)
    : sort === "title" ? asc(channels.title)
    : desc(scores.adScore);

  const rows = await db
    .select({
      id: channels.id,
      title: channels.title,
      username: channels.username,
      description: channels.description,
      category: channels.category,
      subscribers: channels.subscribers,
      isDemo: channels.isDemo,
      inviteUrl: channels.inviteUrl,
      lastAnalysedAt: channels.lastAnalysedAt,
      avgViews: scores.avgViews,
      engagementRate: scores.engagementRate,
      viewsRate: scores.viewsRate,
      postingFrequency: scores.postingFrequency,
      qualityScore: scores.qualityScore,
      adScore: scores.adScore,
      lastActiveAt: scores.lastActiveAt,
    })
    .from(channels)
    .leftJoin(scores, eq(channels.id, scores.channelId))
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(channels)
    .where(where);
  return NextResponse.json({ ok: true, channels: rows, total: totalRows[0]?.n ?? 0, page, pageSize });
}
