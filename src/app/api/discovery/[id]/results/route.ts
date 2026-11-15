import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { discoveryJobs, jobResults, channels, scores } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET — analysed channel results for a job with computed metrics. */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const job = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, id)).limit(1);
  if (!job[0]) return jsonError(404, "Search job not found.");
  if (job[0].userId !== user.id && user.role !== "admin") return jsonError(403, "Not your search.");

  const rows = await db
    .select({
      resultId: jobResults.id,
      source: jobResults.source,
      skipped: jobResults.skipped,
      skipReason: jobResults.skipReason,
      channelId: channels.id,
      title: channels.title,
      username: channels.username,
      description: channels.description,
      category: channels.category,
      subscribers: channels.subscribers,
      inviteUrl: channels.inviteUrl,
      isDemo: channels.isDemo,
      lastAnalysedAt: channels.lastAnalysedAt,
      avgViews: scores.avgViews,
      medianViews: scores.medianViews,
      viewsRate: scores.viewsRate,
      engagementRate: scores.engagementRate,
      avgReactions: scores.avgReactions,
      avgComments: scores.avgComments,
      postingFrequency: scores.postingFrequency,
      lastActiveAt: scores.lastActiveAt,
      qualityScore: scores.qualityScore,
      adScore: scores.adScore,
      adClass: scores.adClass,
    })
    .from(jobResults)
    .innerJoin(channels, eq(jobResults.channelId, channels.id))
    .leftJoin(scores, eq(jobResults.channelId, scores.channelId))
    .where(eq(jobResults.jobId, id))
    .orderBy(asc(jobResults.id));

  return NextResponse.json({ ok: true, results: rows, job: job[0] });
}
