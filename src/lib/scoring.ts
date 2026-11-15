import type { ScoringWeights } from "./settings";

export type PostRow = {
  publishedAt: Date;
  views: number | null;
  reactions: number | null;
  comments: number | null;
  forwards: number | null;
};

export type ChannelLike = {
  title: string;
  username: string;
  description: string;
  category: string;
  subscribers: number;
};

export type Metrics = {
  postCount: number;
  avgViews: number | null;
  medianViews: number | null;
  viewsRate: number | null; // percent
  engagementRate: number | null; // percent
  avgReactions: number | null;
  avgComments: number | null; // null = unavailable (never treated as zero)
  avgForwards: number | null;
  postingFrequency: number | null; // posts per day
  lastActiveAt: Date | null;
  commentsAvailable: boolean;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Section 5 metric calculations. Unavailable comments stay null, never zero. */
export function computeMetrics(
  postsSeen: PostRow[],
  subscribers: number,
  periodDays: number
): Metrics {
  const views = postsSeen.map((p) => p.views).filter((v): v is number => v !== null);
  const reactions = postsSeen.map((p) => p.reactions).filter((v): v is number => v !== null);
  const commentVals = postsSeen.map((p) => p.comments).filter((v): v is number => v !== null);
  const forwards = postsSeen.map((p) => p.forwards).filter((v): v is number => v !== null);

  const avgViews = mean(views);
  const avgReactions = mean(reactions);
  const commentsAvailable = commentVals.length > postsSeen.length * 0.3;
  const avgComments = commentsAvailable ? mean(commentVals) : null;
  const avgForwards = mean(forwards);

  const viewsRate =
    avgViews !== null && subscribers > 0 ? (avgViews / subscribers) * 100 : null;

  // ER = ((avg reactions + avg comments) / subscribers) * 100.
  // When comments are unavailable we compute on reactions only and flag it.
  const engagementNumerator = (avgReactions ?? 0) + (avgComments ?? 0);
  const hasEngagementData = avgReactions !== null || avgComments !== null;
  const engagementRate =
    hasEngagementData && subscribers > 0 ? (engagementNumerator / subscribers) * 100 : null;

  const dates = postsSeen.map((p) => p.publishedAt).sort((a, b) => b.getTime() - a.getTime());
  const lastActiveAt = dates[0] ?? null;

  const postingFrequency =
    postsSeen.length > 0 && periodDays > 0 ? postsSeen.length / periodDays : null;

  return {
    postCount: postsSeen.length,
    avgViews: avgViews !== null ? Math.round(avgViews) : null,
    medianViews: median(views) !== null ? Math.round(median(views)!) : null,
    viewsRate: viewsRate !== null ? round2(viewsRate) : null,
    engagementRate: engagementRate !== null ? round2(engagementRate) : null,
    avgReactions: avgReactions !== null ? round2(avgReactions) : null,
    avgComments: avgComments !== null ? round2(avgComments) : null,
    avgForwards: avgForwards !== null ? round2(avgForwards) : null,
    postingFrequency: postingFrequency !== null ? round2(postingFrequency) : null,
    lastActiveAt,
    commentsAvailable,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type QualityFlag = { code: string; severity: string; evidence: string };

/**
 * Section 6 — channel quality assessment. 0-100 based on observable evidence.
 * Flags explain the evidence. No accusation of fake subscribers, only signals.
 */
export function computeQuality(
  channel: ChannelLike,
  metrics: Metrics,
  postsSeen: PostRow[]
): { score: number; flags: QualityFlag[] } {
  const flags: QualityFlag[] = [];
  let score = 100;

  // 1. Views-to-subscriber ratio (typical healthy range ~10-30%+)
  const vr = metrics.viewsRate;
  if (vr === null) {
    score -= 25;
    flags.push({ code: "no_views", severity: "high", evidence: "Post view data is unavailable, quality cannot be fully assessed." });
  } else if (vr < 2) {
    score -= 45;
    flags.push({ code: "very_low_views", severity: "high", evidence: `Average views are only ${vr.toFixed(2)}% of the subscriber count (${metrics.avgViews?.toLocaleString()} avg views vs ${channel.subscribers.toLocaleString()} subscribers). Healthy channels typically reach 10–30%.` });
  } else if (vr < 8) {
    score -= 25;
    flags.push({ code: "low_views", severity: "medium", evidence: `Views rate is ${vr.toFixed(2)}% of subscribers — below the typical 10–30% range for active audiences.` });
  } else if (vr >= 40) {
    score += 2;
    flags.push({ code: "exceptional_reach", severity: "positive", evidence: `Views rate of ${vr.toFixed(1)}% suggests strong organic reach or heavy forwarding.` });
  }

  // 2. Engagement rate sanity
  const er = metrics.engagementRate;
  if (er !== null && vr !== null) {
    if (er > 25) {
      score -= 15;
      flags.push({ code: "unusual_engagement", severity: "medium", evidence: `Engagement rate of ${er.toFixed(1)}% is unusually high relative to view counts — engagement may be incentivised or botted.` });
    } else if (er < 0.05 && channel.subscribers > 5000) {
      score -= 10;
      flags.push({ code: "no_reactions", severity: "low", evidence: `Audience almost never reacts (${er.toFixed(3)}% ER) despite ${channel.subscribers.toLocaleString()} subscribers.` });
    } else if (er >= 1 && er <= 12) {
      flags.push({ code: "healthy_engagement", severity: "positive", evidence: `Engagement rate ${er.toFixed(2)}% sits in the healthy 1–12% band.` });
    }
  }

  // 3. Posting regularity — coefficient of variation of gaps between posts
  const dates = postsSeen.map((p) => p.publishedAt.getTime()).sort((a, b) => a - b);
  if (dates.length >= 4) {
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 3_600_000);
    const gMean = mean(gaps) ?? 0;
    const variance = mean(gaps.map((g) => (g - gMean) ** 2)) ?? 0;
    const cv = gMean > 0 ? Math.sqrt(variance) / gMean : 0;
    if (cv > 1.8) {
      score -= 12;
      flags.push({ code: "irregular_posting", severity: "medium", evidence: `Posting gaps vary wildly (CV ${cv.toFixed(1)}). Long silent stretches alternate with bursts — audiences and ads perform inconsistently.` });
    }
  }

  // 4. View volatility
  const views = postsSeen.map((p) => p.views).filter((v): v is number => v !== null);
  if (views.length >= 5) {
    const max = Math.max(...views);
    const min = Math.max(1, Math.min(...views));
    if (max / min > 12) {
      score -= 8;
      flags.push({ code: "volatile_views", severity: "low", evidence: `Post views range from ${min.toLocaleString()} to ${max.toLocaleString()} (${(max / min).toFixed(0)}× spread). Single viral posts may be inflating averages — median views is ${metrics.medianViews?.toLocaleString()}.` });
    }
  }

  // 5. Dormancy
  if (metrics.lastActiveAt) {
    const idleDays = (Date.now() - metrics.lastActiveAt.getTime()) / 86_400_000;
    if (idleDays > 14) {
      score -= 20;
      flags.push({ code: "dormant", severity: "high", evidence: `No posts in the last ${Math.floor(idleDays)} days. Advertising here risks zero exposure.` });
    } else if (idleDays > 5) {
      score -= 8;
      flags.push({ code: "slow_activity", severity: "low", evidence: `Last post was ${Math.floor(idleDays)} days ago — posting cadence is slowing.` });
    }
  }

  // 6. Subscriber vs view sanity for large channels
  if (vr !== null && channel.subscribers > 50000 && vr < 5) {
    score -= 10;
    flags.push({ code: "large_inactive", severity: "medium", evidence: `Large audience (${channel.subscribers.toLocaleString()}) with a ${vr.toFixed(1)}% views rate — consistent with purchased, stale or migrated subscribers. Verify before buying.` });
  }

  // 7. Repetitive posting (duplicate texts)
  const texts = postsSeen.map((p) => (p as unknown as { text?: string }).text).filter(Boolean) as string[];
  if (texts.length >= 5) {
    const unique = new Set(texts.map((t) => t.slice(0, 80)));
    if (unique.size / texts.length < 0.5) {
      score -= 10;
      flags.push({ code: "repetitive_content", severity: "medium", evidence: `Only ${unique.size} unique openings across ${texts.length} posts — heavy reposting/looping content pattern.` });
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, flags };
}

export type AdBreakdown = Record<string, { points: number; max: number; reason: string }>;

/** Section 7 — advertising potential score with configurable weights. */
export function computeAdScore(
  channel: ChannelLike,
  metrics: Metrics,
  keywords: string[],
  weights: ScoringWeights
): { score: number; breakdown: AdBreakdown } {
  const breakdown: AdBreakdown = {};
  const kwTokens = keywords
    .flatMap((k) => k.toLowerCase().split(/[^a-z0-9]+/))
    .filter((t) => t.length > 2);
  const hay = `${channel.title} ${channel.description} ${channel.username}`.toLowerCase();

  // Relevance (default 30)
  {
    const max = weights.relevance;
    const hits = kwTokens.filter((t) => hay.includes(t));
    const ratio = kwTokens.length ? hits.length / kwTokens.length : 0;
    const points = Math.round(max * Math.min(1, ratio * 1.4));
    breakdown.relevance = {
      points,
      max,
      reason: hits.length
        ? `Matched keywords: ${[...new Set(hits)].join(", ")} in channel title/description/username.`
        : "No keyword tokens found in the channel's public metadata.",
    };
  }

  // Views reach (default 20) — logarithmic scale: 1k=8, 10k=14, 50k=18, 100k+=20
  {
    const max = weights.views;
    const av = metrics.avgViews ?? 0;
    const points = av <= 0 ? 0 : Math.min(max, Math.round((Math.log10(av) / 5) * max));
    breakdown.views = {
      points,
      max,
      reason: av > 0 ? `Average post reach of ${av.toLocaleString()} views.` : "No view data available.",
    };
  }

  // Engagement (default 20) — 5% ER ≈ full
  {
    const max = weights.engagement;
    const er = metrics.engagementRate;
    const points = er === null ? 0 : Math.min(max, Math.round((Math.min(er, 15) / 5) * max * 0.55));
    breakdown.engagement = {
      points,
      max,
      reason:
        er === null
          ? "No public engagement data available."
          : metrics.commentsAvailable
            ? `Engagement rate ${er.toFixed(2)}% (reactions + comments).`
            : `Engagement rate ${er.toFixed(2)}% (reactions only — comments unavailable).`,
    };
  }

  // Consistency (default 15)
  {
    const max = weights.consistency;
    const freq = metrics.postingFrequency ?? 0;
    let points = 0;
    if (freq >= 0.4 && freq <= 8) points = max;
    else if (freq > 8) points = Math.round(max * 0.6);
    else if (freq > 0.1) points = Math.round(max * (freq / 0.4));
    breakdown.consistency = {
      points,
      max,
      reason: freq > 0
        ? `Publishes ~${freq.toFixed(1)} posts/day across the analysis window.`
        : "No posting activity detected in the analysis window.",
    };
  }

  // Recency (default 10)
  {
    const max = weights.recency;
    let points = 0;
    let reason = "No recent activity recorded.";
    if (metrics.lastActiveAt) {
      const idle = (Date.now() - metrics.lastActiveAt.getTime()) / 86_400_000;
      if (idle <= 1) { points = max; reason = `Active within the last 24 hours.`; }
      else if (idle <= 3) { points = Math.round(max * 0.8); reason = `Last active ${Math.floor(idle)} days ago.`; }
      else if (idle <= 7) { points = Math.round(max * 0.5); reason = `Last active ${Math.floor(idle)} days ago.`; }
      else { points = 0; reason = `Inactive for ${Math.floor(idle)} days.`; }
    }
    breakdown.recency = { points, max, reason };
  }

  // Audience suitability (default 5)
  {
    const max = weights.audience;
    const catMatch = kwTokens.some((t) => channel.category.toLowerCase().includes(t));
    const points = catMatch ? max : Math.round(max * 0.4);
    breakdown.audience = {
      points,
      max,
      reason: catMatch
        ? `Channel category "${channel.category}" aligns with the search intent.`
        : `Category "${channel.category}" is a partial match for the target audience.`,
    };
  }

  const score = Math.min(
    100,
    Object.values(breakdown).reduce((a, b) => a + b.points, 0)
  );
  return { score, breakdown };
}
