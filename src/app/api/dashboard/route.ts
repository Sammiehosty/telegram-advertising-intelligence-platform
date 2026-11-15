import { NextResponse } from "next/server";
import { eq, desc, sql, gte } from "drizzle-orm";
import { db } from "@/db";
import { channels, scores, discoveryJobs, savedChannels, campaigns } from "@/db/schema";
import { requireUser, isErrorResponse } from "@/lib/api";
import { runMonitorPassForUser } from "@/lib/discovery";

/** GET /api/dashboard — overview statistics + chart series. */
export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;

  // Lazy monitoring pass (Section 17) — cheap, runs at most for due items.
  void runMonitorPassForUser(user.id).catch(() => {});

  const [chanCount] = await db.select({ n: sql<number>`count(*)::int` }).from(channels);
  const [analysedCount] = await db.select({ n: sql<number>`count(*)::int` }).from(scores);
  const [savedCount] = await db.select({ n: sql<number>`count(*)::int` }).from(savedChannels).where(eq(savedChannels.userId, user.id));
  const [excellentCount] = await db.select({ n: sql<number>`count(*)::int` }).from(scores).where(gte(scores.adScore, 90));
  const [avgEr] = await db.select({ v: sql<number>`coalesce(avg(engagement_rate),0)::float8` }).from(scores);
  const [searchCount] = await db.select({ n: sql<number>`count(*)::int` }).from(discoveryJobs).where(eq(discoveryJobs.userId, user.id));
  const [activeCampaigns] = await db.select({ n: sql<number>`count(*)::int` }).from(campaigns).where(sql`${campaigns.userId} = ${user.id} and ${campaigns.status} = 'active'`);

  // Channels discovered per day (last 14 days)
  const perDay = await db.execute(sql`
    select to_char(date_trunc('day', discovered_at), 'YYYY-MM-DD') as day, count(*)::int as n
    from telegram_channels
    where discovered_at > now() - interval '14 days'
    group by 1 order by 1
  `);

  const byCategory = await db.execute(sql`
    select category, count(*)::int as n, coalesce(avg(subscribers),0)::int as avg_subs
    from telegram_channels group by category order by n desc limit 10
  `);

  const adDist = await db.execute(sql`
    select case
      when ad_score >= 90 then 'Excellent (90-100)'
      when ad_score >= 75 then 'Very Good (75-89)'
      when ad_score >= 60 then 'Good (60-74)'
      when ad_score >= 40 then 'Average (40-59)'
      else 'Poor (0-39)' end as bucket, count(*)::int as n
    from channel_analytics group by 1
  `);

  const engagementDist = await db.execute(sql`
    select case
      when engagement_rate < 0.5 then '<0.5%'
      when engagement_rate < 1 then '0.5-1%'
      when engagement_rate < 3 then '1-3%'
      when engagement_rate < 6 then '3-6%'
      when engagement_rate < 12 then '6-12%'
      else '12%+' end as bucket, count(*)::int as n
    from channel_analytics where engagement_rate is not null group by 1
  `);

  const recentJobs = await db
    .select({
      id: discoveryJobs.id, keyword: discoveryJobs.keyword, status: discoveryJobs.status,
      channelsDiscovered: discoveryJobs.channelsDiscovered, channelsAnalysed: discoveryJobs.channelsAnalysed,
      createdAt: discoveryJobs.createdAt,
    })
    .from(discoveryJobs)
    .where(eq(discoveryJobs.userId, user.id))
    .orderBy(desc(discoveryJobs.createdAt))
    .limit(5);

  const topChannels = await db
    .select({
      id: channels.id, title: channels.title, username: channels.username,
      subscribers: channels.subscribers, isDemo: channels.isDemo, category: channels.category,
      adScore: scores.adScore, qualityScore: scores.qualityScore,
      avgViews: scores.avgViews, engagementRate: scores.engagementRate,
    })
    .from(scores)
    .innerJoin(channels, eq(scores.channelId, channels.id))
    .orderBy(desc(scores.adScore))
    .limit(6);

  const recentChannels = await db
    .select({
      id: channels.id, title: channels.title, username: channels.username,
      subscribers: channels.subscribers, isDemo: channels.isDemo,
      category: channels.category, discoveredAt: channels.discoveredAt,
      adScore: scores.adScore,
    })
    .from(channels)
    .leftJoin(scores, eq(channels.id, scores.channelId))
    .orderBy(desc(channels.discoveredAt))
    .limit(6);

  return NextResponse.json({
    ok: true,
    stats: {
      totalChannels: chanCount?.n ?? 0,
      analysed: analysedCount?.n ?? 0,
      saved: savedCount?.n ?? 0,
      excellent: excellentCount?.n ?? 0,
      avgEngagement: Number((avgEr?.v ?? 0).toFixed(2)),
      totalSearches: searchCount?.n ?? 0,
      activeCampaigns: activeCampaigns?.n ?? 0,
    },
    charts: {
      perDay: (perDay.rows as { day: string; n: number }[]).map((r) => ({ day: r.day.slice(5), count: r.n })),
      byCategory: byCategory.rows as { category: string; n: number; avg_subs: number }[],
      adDist: adDist.rows as { bucket: string; n: number }[],
      engagementDist: engagementDist.rows as { bucket: string; n: number }[],
    },
    recentJobs,
    topChannels,
    recentChannels,
  });
}
