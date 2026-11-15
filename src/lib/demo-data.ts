/**
 * Deterministic sample corpus used by the DEMO discovery provider.
 * Everything generated here is clearly flagged with isDemo=true and labelled
 * "Sample data" in the UI. It exists so the full pipeline (dedupe, analysis,
 * scoring, comparison, reporting) is functional before live Telegram
 * credentials are connected. It is never mixed with live results: live
 * providers store channels with isDemo=false.
 */

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEXICON: Record<string, { roots: string[]; suffix: string[]; category: string }> = {
  crypto: { roots: ["Crypto", "Bitcoin", "BTC", "Altcoin", "DeFi", "Blockchain", "Coin", "Token", "Web3", "Hodl"], suffix: ["Hub", "Daily", "Insider", "Signals", "Lab", "Whale", "Digest", "Alerts", "Pro", "Zone", "Pulse", "Radar"], category: "Crypto & Finance" },
  trading: { roots: ["Forex", "Trading", "Trader", "FX", "Market", "Pips", "Chart", "Signal", "Bull", "DayTrade"], suffix: ["Signals", "Academy", "Hub", "Pro", "Desk", "Insider", "Alerts", "Masters", "Lab", "Edge", "Room", "Daily"], category: "Trading & Forex" },
  betting: { roots: ["Bet", "Odds", "Football", "Tipster", "Score", "Match", "Goal", "Accumulator", "Bookmaker", "Punter"], suffix: ["Tips", "Predictions", "Pro", "Hub", "Daily", "Insider", "King", "Masters", "Zone", "Alerts", "Edge", "Lab"], category: "Sports & Betting" },
  business: { roots: ["Invest", "Wealth", "Money", "Passive", "Income", "Millionaire", "Startup", "Finance", "Profit", "Dividend"], suffix: ["Hub", "Daily", "Mindset", "Pro", "Insider", "Academy", "Lab", "Digest", "Club", "Zone", "Pulse", "Journal"], category: "Business & Investing" },
  tech: { roots: ["Tech", "Dev", "Code", "Hosting", "Cloud", "Gadget", "AI", "Server", "Cyber", "DevOps"], suffix: ["Daily", "Hub", "News", "Insider", "Lab", "Digest", "Pro", "Zone", "Review", "Radar", "Times", "World"], category: "Technology" },
  education: { roots: ["Scholarship", "Study", "Edu", "Learn", "College", "Exam", "Tutor", "Course", "Academic", "Student"], suffix: ["Hub", "Daily", "Alert", "Pro", "Guide", "Digest", "News", "World", "Zone", "Club", "Central", "Desk"], category: "Education" },
  news: { roots: ["News", "Daily", "World", "Breaking", "Global", "Today", "Press", "Herald", "Wire", "Times"], suffix: ["Now", "24", "Hub", "Daily", "Feed", "Update", "Live", "Desk", "Room", "Central", "Watch", "Report"], category: "News & Politics" },
  entertainment: { roots: ["Movie", "Meme", "Fun", "Viral", "Celeb", "Music", "Show", "Laugh", "Buzz", "Pop"], suffix: ["Hub", "Daily", "Zone", "Club", "World", "Feed", "Central", "Box", "Time", "Land", "Spot", "Vibe"], category: "Entertainment" },
  gaming: { roots: ["Game", "Gaming", "Esport", "Gamer", "Play", "Pixel", "Quest", "Loot", "Frag", "Arena"], suffix: ["Hub", "Daily", "Zone", "News", "Pro", "Central", "World", "Den", "Vault", "Lab", "Insider", "Feed"], category: "Gaming" },
};

const CATEGORY_OF_KEYWORD: [RegExp, keyof typeof LEXICON][] = [
  [/crypto|bitcoin|btc|altcoin|usdt|defi|blockchain|web3/i, "crypto"],
  [/forex|trading|trade|pips|fx|signal/i, "trading"],
  [/bet|football|soccer|odd|prediction|tipster|sport/i, "betting"],
  [/invest|money|income|wealth|business|finance|earn/i, "business"],
  [/tech|hosting|web|code|developer|cloud|software|ai\b/i, "tech"],
  [/education|scholarship|study|school|course|college|exam/i, "education"],
  [/news|politic|breaking|world/i, "news"],
  [/entertainment|movie|music|meme|celebrity|film/i, "entertainment"],
  [/gam(e|ing)|esport|playstation|xbox|pc gaming/i, "gaming"],
];

function lexiconFor(keyword: string) {
  for (const [re, key] of CATEGORY_OF_KEYWORD) {
    if (re.test(keyword)) return LEXICON[key];
  }
  return {
    roots: [keyword.replace(/[^a-zA-Z ]/g, "").split(" ")[0] || "Channel"].map(
      (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    ),
    suffix: ["Hub", "Daily", "Central", "Insider", "World", "Pro", "News", "Club", "Spot", "Lab"],
    category: "Other",
  };
}

export type Archetype = "healthy" | "quiet-large" | "hyped" | "volatile" | "dormant" | "irregular";

export type GenChannel = {
  username: string;
  title: string;
  description: string;
  category: string;
  language: string;
  subscribers: number;
  archetype: Archetype;
  seed: number;
};

export function pickArchetype(r: number): Archetype {
  if (r < 0.5) return "healthy";
  if (r < 0.65) return "quiet-large";
  if (r < 0.75) return "hyped";
  if (r < 0.85) return "volatile";
  if (r < 0.93) return "dormant";
  return "irregular";
}

const DESCS = [
  (kw: string) => `Daily ${kw} signals, analysis and market updates. Join ${randRef()}k+ members. Not financial advice.`,
  (kw: string) => `Your #1 source for ${kw}. News, guides and community discussion every day.`,
  (kw: string) => `${cap(kw)} community channel — insights, tips and discussions.`,
  (kw: string) => `Premium ${kw} content. Analysis, education and updates.`,
  (kw: string) => `Everything about ${kw} in one place. Curated by experts.`,
];
function randRef() { return ""; }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function generateChannels(keyword: string, limit: number): GenChannel[] {
  const lex = lexiconFor(keyword);
  const rng = mulberry32(hashString(`corpus:${keyword.toLowerCase()}`));
  const out: GenChannel[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < limit && guard < limit * 30) {
    guard++;
    const root = lex.roots[Math.floor(rng() * lex.roots.length)];
    const suffix = lex.suffix[Math.floor(rng() * lex.suffix.length)];
    const num = rng() < 0.45 ? Math.floor(rng() * 98) + 1 : "";
    const sep = rng() < 0.3 ? "_" : "";
    let username = `${root}${suffix}${sep}${num}`.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (username.length < 5) username += "hq";
    username = username.slice(0, 28);
    if (used.has(username)) continue;
    used.add(username);

    const seed = hashString(username);
    const crng = mulberry32(seed);
    const archetype = pickArchetype(crng());
    let subscribers: number;
    if (archetype === "quiet-large") {
      subscribers = Math.floor(Math.exp(crng() * (Math.log(1_200_000) - Math.log(80_000)) + Math.log(80_000)));
    } else if (crng() < 0.08) {
      subscribers = Math.floor(Math.exp(crng() * (Math.log(900_000) - Math.log(150_000)) + Math.log(150_000)));
    } else {
      subscribers = Math.floor(Math.exp(crng() * (Math.log(250_000) - Math.log(420)) + Math.log(420)));
    }
    const descFn = DESCS[Math.floor(crng() * DESCS.length)];
    const kw = crng() < 0.8 ? keyword.toLowerCase() : root.toLowerCase();
    out.push({
      username,
      title: `${root} ${suffix}${num ? ` ${num}` : ""}`,
      description: descFn(kw),
      category: lex.category,
      language: "en",
      subscribers,
      archetype,
      seed,
    });
  }
  return out;
}

export type GenPost = {
  messageId: number;
  text: string;
  publishedAt: Date;
  views: number;
  reactions: number;
  comments: number | null;
  forwards: number;
  isPromo: boolean;
  url: string;
};

const POST_TEMPLATES = [
  (kw: string) => `🚀 ${cap(kw)} update: market sentiment turning bullish. Full breakdown in our latest analysis.`,
  (kw: string) => `${cap(kw)} daily digest — top 5 things you missed today. Stay sharp.`,
  (kw: string) => `Chart of the day for ${kw} traders. Watch the key level.`,
  (kw: string) => `New guide: how beginners can get started with ${kw} in 2026.`,
  (kw: string) => `Community poll: what's your ${kw} prediction for this week?`,
  (kw: string) => `#ad Spotlight partner — check out this platform our readers love. Sponsored placement.`,
  (kw: string) => `Sponsored message: exclusive offer for our ${kw} community. #sponsored`,
  (kw: string) => `Promo: premium ${kw} signals now 50% off this week only. #promotion`,
];

export function generatePosts(ch: GenChannel, periodDays: number, keyword: string): GenPost[] {
  const rng = mulberry32(hashString(`${ch.username}:${periodDays}`));
  const posts: GenPost[] = [];

  let postsPerDay: number;
  let viewRatio: number;
  let erBase: number;
  let commentsOn = rng() < 0.65;
  let dormantDays = 0;
  let regularity = 1;

  switch (ch.archetype) {
    case "healthy":
      postsPerDay = 0.5 + rng() * 3.5;
      viewRatio = 0.12 + rng() * 0.3;
      erBase = 0.008 + rng() * 0.05;
      break;
    case "quiet-large":
      postsPerDay = 0.3 + rng() * 1.5;
      viewRatio = 0.005 + rng() * 0.04;
      erBase = 0.0005 + rng() * 0.004;
      break;
    case "hyped":
      postsPerDay = 1 + rng() * 4;
      viewRatio = 0.15 + rng() * 0.25;
      erBase = 0.18 + rng() * 0.15;
      break;
    case "volatile":
      postsPerDay = 0.8 + rng() * 2.5;
      viewRatio = 0.08 + rng() * 0.3;
      erBase = 0.005 + rng() * 0.03;
      break;
    case "dormant":
      postsPerDay = 0.5 + rng() * 2;
      viewRatio = 0.05 + rng() * 0.2;
      erBase = 0.004 + rng() * 0.03;
      dormantDays = 6 + rng() * 24;
      break;
    default:
      postsPerDay = 0.4 + rng() * 3;
      viewRatio = 0.06 + rng() * 0.25;
      erBase = 0.005 + rng() * 0.04;
      regularity = 3 + rng() * 4;
  }

  const now = Date.now();
  const windowMs = periodDays * 86_400_000;
  const activeWindow = Math.max(0.5, periodDays - dormantDays);
  const count = Math.max(1, Math.round(activeWindow * postsPerDay * (0.7 + rng() * 0.6)));

  let cursor = now - dormantDays * 86_400_000 - rng() * 3_600_000;
  for (let i = 0; i < count; i++) {
    const gapHours = (24 / postsPerDay) * (0.5 + rng() * regularity);
    cursor -= gapHours * 3_600_000;
    if (cursor < now - windowMs) break;

    const viral = rng() < 0.05 ? 3 + rng() * 6 : 1;
    const dip = rng() < 0.08 ? 0.15 + rng() * 0.2 : 1;
    const noise = Math.exp((rng() + rng() + rng() - 1.5) * 0.5);
    const views = Math.max(15, Math.round(ch.subscribers * viewRatio * noise * viral * dip));
    const erNoise = erBase * (0.6 + rng() * 0.9);
    const reactions = Math.round(views * erNoise);
    const comments = commentsOn ? Math.round(views * erNoise * (0.08 + rng() * 0.3)) : null;
    const forwards = Math.round(views * (0.001 + rng() * 0.012) * viral);

    const isPromo = rng() < 0.13;
    const tmpl = POST_TEMPLATES[Math.floor(rng() * (isPromo ? 8 : 5))];
    const text = tmpl(keyword.toLowerCase());
    const hasLink = rng() < 0.35;
    posts.push({
      messageId: 1000 + i,
      text: hasLink ? `${text}\n🔗 https://t.me/s/${ch.username}` : text,
      publishedAt: new Date(cursor),
      views,
      reactions,
      comments,
      forwards,
      isPromo,
      url: `https://t.me/s/${ch.username}/${1000 + i}`,
    });
  }
  return posts.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
