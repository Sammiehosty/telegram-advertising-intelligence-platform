import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { discoveryJobs, channels } from "@/db/schema";
import { requireUser, isErrorResponse, str, intOr, jsonError } from "@/lib/api";
import { runDiscovery, type SearchOptions } from "@/lib/discovery";

/** GET /api/discovery — search history for the current user. */
export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const rows = await db
    .select({
      id: discoveryJobs.id,
      keyword: discoveryJobs.keyword,
      relatedKeywords: discoveryJobs.relatedKeywords,
      status: discoveryJobs.status,
      progress: discoveryJobs.progress,
      channelsDiscovered: discoveryJobs.channelsDiscovered,
      channelsAnalysed: discoveryJobs.channelsAnalysed,
      createdAt: discoveryJobs.createdAt,
      bestChannelId: discoveryJobs.bestChannelId,
      bestTitle: channels.title,
      bestUsername: channels.username,
    })
    .from(discoveryJobs)
    .leftJoin(channels, eq(discoveryJobs.bestChannelId, channels.id))
    .where(eq(discoveryJobs.userId, user.id))
    .orderBy(desc(discoveryJobs.createdAt))
    .limit(100);
  return NextResponse.json({ ok: true, jobs: rows });
}

/** POST /api/discovery — start a new discovery job. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  try {
    const body = await req.json();
    const keyword = str(body.keyword, 120);
    if (!keyword) return jsonError(400, "Enter at least one keyword.");
    const related: string[] = Array.isArray(body.relatedKeywords)
      ? body.relatedKeywords.map((k: unknown) => str(k, 60)).filter(Boolean).slice(0, 12)
      : [];
    const limit = [20, 50, 100, 250, 500].includes(body.limit) ? body.limit : 50;
    const periodDays = [7, 14, 30, 60, 90].includes(body.periodDays) ? body.periodDays : 30;

    const f = body.filters ?? {};
    const filters = {
      minSubs: intOr(f.minSubs),
      maxSubs: intOr(f.maxSubs),
      minAvgViews: intOr(f.minAvgViews),
      minER: typeof f.minER === "number" ? f.minER : intOr(f.minER),
      maxER: typeof f.maxER === "number" ? f.maxER : intOr(f.maxER),
      activeWithinDays: intOr(f.activeWithinDays),
      minFreq: typeof f.minFreq === "number" ? f.minFreq : null,
      maxFreq: typeof f.maxFreq === "number" ? f.maxFreq : null,
      category: str(f.category, 60) || null,
      language: str(f.language, 12) || null,
    };

    const options: SearchOptions = { limit, periodDays, filters };
    const inserted = await db
      .insert(discoveryJobs)
      .values({ userId: user.id, keyword, relatedKeywords: related, options })
      .returning({ id: discoveryJobs.id });

    const jobId = inserted[0].id;
    // Fire-and-forget background runner (long-running Node server).
    void runDiscovery(jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    console.error(err);
    return jsonError(500, "Could not start the search. Please try again.");
  }
}
