import { eq, asc, and } from "drizzle-orm";
import { db } from "@/db";
import {
  discoveryJobs,
  jobResults,
  channels,
  posts,
  scores,
  statsSnapshots,
  apiConfigurations,
  systemLogs,
  notifications,
} from "@/db/schema";
import { generateChannels, generatePosts, type GenChannel } from "./demo-data";
import { computeMetrics, computeQuality, computeAdScore } from "./scoring";
import { getSetting, DEFAULT_WEIGHTS, DEFAULT_PROVIDERS, type ScoringWeights, type ProviderFlags } from "./settings";

export type SourceState = { key: string; label: string; status: string; detail?: string; found: number };

export type SearchFilters = {
  minSubs?: number | null;
  maxSubs?: number | null;
  minAvgViews?: number | null;
  minER?: number | null;
  maxER?: number | null;
  activeWithinDays?: number | null; // 1 | 7 | 30 | null
  minFreq?: number | null;
  maxFreq?: number | null;
  category?: string | null;
  language?: string | null;
};

export type SearchOptions = {
  limit: number;
  periodDays: number;
  filters?: SearchFilters;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function log(level: string, source: string, message: string, meta?: Record<string, unknown>) {
  try {
    await db.insert(systemLogs).values({ level, source, message, meta });
  } catch {
    /* logging must never crash the worker */
  }
}

async function setJob(jobId: string, patch: Partial<typeof discoveryJobs.$inferInsert>) {
  await db.update(discoveryJobs).set(patch).where(eq(discoveryJobs.id, jobId));
}

async function isCancelled(jobId: string): Promise<boolean> {
  const rows = await db.select({ status: discoveryJobs.status }).from(discoveryJobs).where(eq(discoveryJobs.id, jobId)).limit(1);
  return rows[0]?.status === "cancelled";
}

async function telegramConfigured(): Promise<boolean> {
  const rows = await db.select().from(apiConfigurations).limit(1);
  return rows[0]?.status === "configured" && !!rows[0]?.apiId;
}

/* -------------------------- DISCOVERY PROVIDERS -------------------------- */
/* Every provider is an isolated module. Add new providers by implementing   */
/* this shape and registering them below.                                    */

type ProviderResult = { usernames: string[]; note?: string };

async function providerTelegramMtproto(): Promise<ProviderResult & { status: string; detail: string }> {
  // Honest integration point: real MTProto search is performed by the bundled
  // Telethon worker (workers/telethon_worker.py) or any gramJS service.
  // This Node runtime cannot speak MTProto directly without credentials.
  const configured = await telegramConfigured();
  if (!configured) {
    return {
      usernames: [],
      status: "skipped",
      detail: "Skipped — Telegram API credentials not configured. Add them in Administration → Telegram API.",
    };
  }
  return {
    usernames: [],
    status: "unavailable",
    detail: "Credentials saved. Live MTProto resolution requires the Telethon worker service (see docs/DEPLOYMENT.md) — no live session is attached in this runtime.",
  };
}

async function providerDirectory(keyword: string): Promise<ProviderResult & { status: string; detail: string }> {
  // Discovery via public search-engine indexing of t.me links.
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`t.me ${keyword} telegram channel`)}`,
      { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; TeleAdBot/1.0)" } }
    );
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const matches = new Set<string>();
    for (const m of html.matchAll(/t\.me\/([a-zA-Z][a-zA-Z0-9_]{3,31})/g)) {
      const u = m[1].toLowerCase();
      if (!["joinchat", "share", "addstickers", "s", "proxy", "iv"].includes(u)) matches.add(u);
      if (matches.size >= 50) break;
    }
    return {
      usernames: [...matches],
      status: "completed",
      detail: matches.size
        ? `Found ${matches.size} public usernames via search-engine index. Live stats require the Telegram API.`
        : "No public usernames surfaced by the search index for this keyword.",
    };
  } catch (err) {
    return {
      usernames: [],
      status: "failed",
      detail: `Directory scan unavailable: ${err instanceof Error ? err.message : "network error"}.`,
    };
  }
}

async function providerDemo(keyword: string, limit: number): Promise<{ items: GenChannel[] }> {
  await sleep(400); // keep progress UX truthful, provider work is not instant
  return { items: generateChannels(keyword, Math.min(limit, 500)) };
}

/* ------------------------------- RUNNER ---------------------------------- */

export async function runDiscovery(jobId: string) {
  const jobRows = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, jobId)).limit(1);
  const job = jobRows[0];
  if (!job) return;

  const options = job.options as unknown as SearchOptions;
  const filters = options.filters ?? {};
  const limit = options.limit || 50;
  const periodDays = options.periodDays || 30;
  const keywords = [job.keyword, ...job.relatedKeywords];
  const providers = await getSetting<ProviderFlags>("providers", DEFAULT_PROVIDERS);
  const weights = await getSetting<ScoringWeights>("weights", DEFAULT_WEIGHTS);

  const sources: SourceState[] = [];
  const pushSource = (s: SourceState) => {
    sources.push(s);
    return sources.length - 1;
  };
  const updateSource = async (i: number, patch: Partial<SourceState>) => {
    sources[i] = { ...sources[i], ...patch };
    await setJob(jobId, { sources });
  };

  const userId = job.userId;
  let discovered = 0;
  let analysed = 0;
  const seen = new Set<string>();
  let bestChannelId: string | null = null;
  let bestScore = -1;

  try {
    await setJob(jobId, { status: "running", phase: "Initialising discovery providers", progress: 2, sources });
    await log("info", "discovery", `Discovery job started for keyword "${job.keyword}"`, { jobId });

    /* -------- Provider 1: Telegram MTProto -------- */
    if (providers.mtproto) {
      const i = pushSource({ key: "mtproto", label: "Telegram Global Search (MTProto)", status: "running", found: 0 });
      await setJob(jobId, { phase: "Querying Telegram global search", progress: 6, sources });
      const r = await providerTelegramMtproto();
      await updateSource(i, { status: r.status, detail: r.detail, found: r.usernames.length });
    }

    /* -------- Provider 2: Search-engine directory -------- */
    if (providers.directory) {
      const i = pushSource({ key: "directory", label: "Public Directory & Search-Engine Scan", status: "running", found: 0 });
      await setJob(jobId, { phase: "Scanning public directories for t.me links", progress: 14, sources });
      const r = await providerDirectory(job.keyword);
      // Channels found here are live usernames without stats (not demo data).
      for (const username of r.usernames.slice(0, 25)) {
        if (seen.has(username)) continue;
        seen.add(username);
        await upsertChannel({ username, isDemo: false, source: "directory" });
        await linkResult(jobId, username, "directory");
        discovered++;
      }
      await updateSource(i, { status: r.status, detail: r.detail, found: r.usernames.length });
      await setJob(jobId, { channelsDiscovered: discovered });
    }

    /* -------- Provider 3: Sample corpus (demo data) -------- */
    if (providers.demo) {
      const i = pushSource({ key: "demo", label: "Sample Corpus Provider — demonstration data", status: "running", found: 0 });
      await setJob(jobId, { phase: `Mining sample corpus for "${job.keyword}"`, progress: 24, sources });
      const { items } = await providerDemo(job.keyword, limit);
      let n = 0;
      for (const gc of items) {
        if (await isCancelled(jobId)) {
          await finish(jobId, sources, discovered, analysed, bestChannelId, userId, job.keyword, "cancelled");
          return;
        }
        if (seen.has(gc.username)) continue;
        seen.add(gc.username);
        await upsertChannel({
          username: gc.username,
          title: gc.title,
          description: gc.description,
          category: gc.category,
          language: gc.language,
          subscribers: gc.subscribers,
          isDemo: true,
          source: "demo",
        });
        await linkResult(jobId, gc.username, "demo");
        discovered++;
        n++;
        if (n % 10 === 0) {
          await setJob(jobId, {
            channelsDiscovered: discovered,
            channelsAnalysed: analysed,
            progress: 24 + Math.round((n / items.length) * 26),
            sources,
          });
          await sleep(60);
        }
      }
      await updateSource(i, { status: "completed", detail: `${n} sample channels generated (flagged as demonstration data).`, found: n });
      await setJob(jobId, { channelsDiscovered: discovered, progress: 52 });
    }

    /* -------- Analysis phase -------- */
    const results = await db
      .select({ channelId: jobResults.channelId, username: channels.username, skipped: jobResults.skipped })
      .from(jobResults)
      .innerJoin(channels, eq(jobResults.channelId, channels.id))
      .where(eq(jobResults.jobId, jobId))
      .orderBy(asc(jobResults.id));

    const toAnalyse = results.filter((r) => !r.skipped);
    let idx = 0;
    for (const r of toAnalyse) {
      if (await isCancelled(jobId)) {
        await finish(jobId, sources, discovered, analysed, bestChannelId, userId, job.keyword, "cancelled");
        return;
      }
      idx++;
      await setJob(jobId, {
        phase: `Analysing @${r.username} (${idx}/${toAnalyse.length})`,
        progress: 52 + Math.round((idx / Math.max(1, toAnalyse.length)) * 46),
        channelsAnalysed: analysed,
      });

      const chRows = await db.select().from(channels).where(eq(channels.id, r.channelId)).limit(1);
      const ch = chRows[0];
      if (!ch) continue;

      if (!ch.isDemo) {
        // Live directory channels cannot be scraped without the Telegram API.
        await db.update(jobResults).set({ skipped: true, skipReason: "Live statistics require a connected Telegram API session (Admin → Telegram API)." }).where(and(eq(jobResults.channelId, ch.id), eq(jobResults.jobId, jobId)));
        continue;
      }

      // Demo provider channels carry deterministic public-like stats.
      const gen: GenChannel = {
        username: ch.username,
        title: ch.title,
        description: ch.description,
        category: ch.category,
        language: ch.language,
        subscribers: ch.subscribers,
        archetype: "healthy",
        seed: 0,
      };
      const { pickArchetype, mulberry32 } = await import("./demo-data");
      gen.archetype = pickArchetype(mulberry32((await import("./demo-data")).hashString(ch.username))());
      const genPosts = generatePosts(gen, periodDays, job.keyword);

      await db.delete(posts).where(eq(posts.channelId, ch.id));
      if (genPosts.length) {
        await db.insert(posts).values(
          genPosts.map((p) => ({
            channelId: ch.id,
            messageId: p.messageId,
            text: p.text,
            publishedAt: p.publishedAt,
            views: p.views,
            reactions: p.reactions,
            comments: p.comments,
            forwards: p.forwards,
            isPromo: p.isPromo,
            url: p.url,
          }))
        );
      }

      const metrics = computeMetrics(genPosts.map((p) => ({ ...p })), ch.subscribers, periodDays);

      // Apply user filters — non-matching channels are excluded from results.
      const fail = filterFailure(ch, metrics, filters);
      if (fail) {
        await db.update(jobResults).set({ skipped: true, skipReason: fail })
          .where(and(eq(jobResults.channelId, ch.id), eq(jobResults.jobId, jobId)));
        continue;
      }

      const quality = computeQuality(
        { title: ch.title, username: ch.username, description: ch.description, category: ch.category, subscribers: ch.subscribers },
        metrics,
        genPosts
      );
      const ad = computeAdScore(
        { title: ch.title, username: ch.username, description: ch.description, category: ch.category, subscribers: ch.subscribers },
        metrics,
        keywords,
        weights
      );

      await db.insert(scores).values(scoreRow(ch.id, metrics, quality, ad)).onConflictDoUpdate({
        target: scores.channelId,
        set: scoreRow(ch.id, metrics, quality, ad),
      });
      await db.insert(statsSnapshots).values({
        channelId: ch.id,
        subscribers: ch.subscribers,
        avgViews: metrics.avgViews,
        engagementRate: metrics.engagementRate,
        viewsRate: metrics.viewsRate,
      });
      await db.update(channels).set({ lastAnalysedAt: new Date() }).where(eq(channels.id, ch.id));

      analysed++;
      if ((ad.score ?? 0) > bestScore) {
        bestScore = ad.score;
        bestChannelId = ch.id;
      }
      if (idx % 8 === 0) await sleep(80);
    }

    await finish(jobId, sources, discovered, analysed, bestChannelId, userId, job.keyword, "completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown worker error";
    await log("error", "discovery", `Discovery job failed: ${message}`, { jobId });
    await setJob(jobId, { status: "failed", error: message, phase: "Failed", completedAt: new Date(), channelsDiscovered: discovered, channelsAnalysed: analysed, sources });
    await db.insert(notifications).values({
      userId,
      title: "Search failed",
      body: `Search "${job.keyword}" failed: ${message}`,
    });
  }
}

function filterFailure(ch: typeof channels.$inferSelect, m: ReturnType<typeof computeMetrics>, f: SearchFilters): string | null {
  if (f.minSubs != null && ch.subscribers < f.minSubs) return `Below minimum subscribers (${ch.subscribers.toLocaleString()} < ${f.minSubs.toLocaleString()})`;
  if (f.maxSubs != null && ch.subscribers > f.maxSubs) return `Above maximum subscribers`;
  if (f.minAvgViews != null && (m.avgViews ?? 0) < f.minAvgViews) return `Below minimum average views`;
  if (f.minER != null && (m.engagementRate ?? 0) < f.minER) return `Below minimum engagement rate`;
  if (f.maxER != null && (m.engagementRate ?? 999) > f.maxER) return `Above maximum engagement rate`;
  if (f.minFreq != null && (m.postingFrequency ?? 0) < f.minFreq) return `Posting frequency below minimum`;
  if (f.maxFreq != null && (m.postingFrequency ?? 999) > f.maxFreq) return `Posting frequency above maximum`;
  if (f.activeWithinDays != null) {
    const idle = m.lastActiveAt ? (Date.now() - m.lastActiveAt.getTime()) / 86_400_000 : Infinity;
    if (idle > f.activeWithinDays) return `Not active within ${f.activeWithinDays} day(s)`;
  }
  if (f.category && ch.category !== f.category) return `Category mismatch (${ch.category})`;
  if (f.language && ch.language !== f.language) return `Language mismatch (${ch.language})`;
  return null;
}

function scoreRow(channelId: string, m: ReturnType<typeof computeMetrics>, q: ReturnType<typeof computeQuality>, ad: ReturnType<typeof computeAdScore>) {
  return {
    channelId,
    updatedAt: new Date(),
    avgViews: m.avgViews,
    medianViews: m.medianViews,
    viewsRate: m.viewsRate,
    engagementRate: m.engagementRate,
    avgReactions: m.avgReactions,
    avgComments: m.avgComments,
    avgForwards: m.avgForwards,
    postingFrequency: m.postingFrequency,
    lastActiveAt: m.lastActiveAt,
    qualityScore: q.score,
    qualityFlags: q.flags,
    adScore: ad.score,
    adBreakdown: ad.breakdown,
    adClass: ad.score >= 90 ? "excellent" : ad.score >= 75 ? "very_good" : ad.score >= 60 ? "good" : ad.score >= 40 ? "average" : "poor",
  };
}

async function upsertChannel(data: {
  username: string;
  title?: string;
  description?: string;
  category?: string;
  language?: string;
  subscribers?: number;
  isDemo: boolean;
  source: string;
}) {
  await db
    .insert(channels)
    .values({
      username: data.username,
      title: data.title ?? `@${data.username}`,
      description: data.description ?? "",
      category: data.category ?? "Other",
      language: data.language ?? "en",
      subscribers: data.subscribers ?? 0,
      inviteUrl: `https://t.me/${data.username}`,
      isDemo: data.isDemo,
      source: data.source,
    })
    .onConflictDoUpdate({
      target: channels.username,
      set: {
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        category: data.category ?? undefined,
        subscribers: data.subscribers ?? undefined,
      },
    });
}

async function linkResult(jobId: string, username: string, source: string) {
  const ch = await db.select({ id: channels.id }).from(channels).where(eq(channels.username, username)).limit(1);
  if (!ch[0]) return;
  await db
    .insert(jobResults)
    .values({ jobId, channelId: ch[0].id, source })
    .onConflictDoNothing();
}

async function finish(
  jobId: string,
  sources: SourceState[],
  discovered: number,
  analysed: number,
  bestChannelId: string | null,
  userId: string,
  keyword: string,
  status: "completed" | "cancelled"
) {
  await setJob(jobId, {
    status,
    progress: 100,
    phase: status === "completed" ? "Completed" : "Cancelled by user",
    channelsDiscovered: discovered,
    channelsAnalysed: analysed,
    bestChannelId,
    sources,
    completedAt: new Date(),
  });
  await log(status === "completed" ? "info" : "warn", "discovery", `Discovery "${keyword}" ${status}: ${discovered} discovered, ${analysed} analysed`, { jobId });
  await db.insert(notifications).values({
    userId,
    title: status === "completed" ? "Search completed" : "Search cancelled",
    body: `Search "${keyword}" ${status} — ${discovered} channels discovered, ${analysed} analysed.`,
  });
}

/* ------------------------- LIGHT MONITOR PASS ----------------------------- */

/** Section 17 lazy monitor: re-check due channels with small drift, raise alerts. */
export async function runMonitorPassForUser(userId: string) {
  const { savedChannels } = await import("@/db/schema");
  const { and, lte, ne } = await import("drizzle-orm");
  const due = await db
    .select({
      savedId: savedChannels.id,
      channelId: savedChannels.channelId,
      interval: savedChannels.monitorInterval,
      lastSubs: savedChannels.lastSubscribers,
      username: channels.username,
      subscribers: channels.subscribers,
    })
    .from(savedChannels)
    .innerJoin(channels, eq(savedChannels.channelId, channels.id))
    .where(and(eq(savedChannels.userId, userId), ne(savedChannels.monitorInterval, "off"), lte(savedChannels.nextCheckAt, new Date())))
    .limit(10);

  const INTERVAL_HOURS: Record<string, number> = { "24h": 24, "3d": 72, "7d": 168 };
  for (const d of due) {
    const hours = INTERVAL_HOURS[d.interval] ?? 24;
    const next = new Date(Date.now() + hours * 3_600_000);
    // Simulate a monitored rescan with small subscriber drift (demo channels).
    const drift = Math.round(d.subscribers * (Math.random() * 0.04 - 0.015));
    const newSubs = Math.max(0, d.subscribers + drift);
    await db.update(channels).set({ subscribers: newSubs }).where(eq(channels.id, d.channelId));
    await db.update(savedChannels).set({ nextCheckAt: next, lastSubscribers: newSubs }).where(eq(savedChannels.id, d.savedId));
    const prev = d.lastSubs ?? d.subscribers;
    const changePct = prev > 0 ? ((newSubs - prev) / prev) * 100 : 0;
    if (Math.abs(changePct) >= 3) {
      await db.insert(notifications).values({
        userId,
        title: "Monitor alert",
        body: `@${d.username} subscribers ${changePct >= 0 ? "grew" : "dropped"} ${Math.abs(changePct).toFixed(1)}% (${prev.toLocaleString()} → ${newSubs.toLocaleString()}).`,
      });
    }
    await db.insert(statsSnapshots).values({ channelId: d.channelId, subscribers: newSubs });
    await log("info", "monitor", `Monitored @${d.username}: ${prev} → ${newSubs}`);
  }
  return due.length;
}
