import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { discoveryJobs, jobResults, channels, scores } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET — CSV export of a search session's analysed results. */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const job = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, id)).limit(1);
  if (!job[0]) return jsonError(404, "Search job not found.");
  if (job[0].userId !== user.id && user.role !== "admin") return jsonError(403, "Not your search.");

  const rows = await db
    .select({
      title: channels.title,
      username: channels.username,
      category: channels.category,
      subscribers: channels.subscribers,
      avgViews: scores.avgViews,
      medianViews: scores.medianViews,
      engagementRate: scores.engagementRate,
      viewsRate: scores.viewsRate,
      postingFrequency: scores.postingFrequency,
      qualityScore: scores.qualityScore,
      adScore: scores.adScore,
      lastActiveAt: scores.lastActiveAt,
      inviteUrl: channels.inviteUrl,
      isDemo: channels.isDemo,
      skipped: jobResults.skipped,
      skipReason: jobResults.skipReason,
    })
    .from(jobResults)
    .innerJoin(channels, eq(jobResults.channelId, channels.id))
    .leftJoin(scores, eq(jobResults.channelId, scores.channelId))
    .where(eq(jobResults.jobId, id))
    .orderBy(asc(jobResults.id));

  const header = [
    "Channel", "Username", "Category", "Subscribers", "Avg Views", "Median Views",
    "Engagement Rate %", "Views Rate %", "Posts/Day", "Quality Score", "Advertising Score",
    "Last Active", "Link", "Data Type", "Filtered Out", "Filter Reason",
  ];
  const lines = rows.map((r) =>
    [
      r.title, `@${r.username}`, r.category, r.subscribers, r.avgViews, r.medianViews,
      r.engagementRate, r.viewsRate, r.postingFrequency, r.qualityScore, r.adScore,
      r.lastActiveAt ? new Date(r.lastActiveAt).toISOString() : "",
      r.inviteUrl, r.isDemo ? "DEMO SAMPLE" : "LIVE",
      r.skipped ? "yes" : "no", r.skipReason ?? "",
    ].map(csvCell).join(",")
  );
  const csv = [
    [`TeleAd Intelligence — Search Report`, `Keyword: ${job[0].keyword}`, `Date: ${job[0].createdAt.toISOString()}`].map(csvCell).join(","),
    header.join(","),
    ...lines,
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="telead-${job[0].keyword.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${id.slice(0, 8)}.csv"`,
    },
  });
}
