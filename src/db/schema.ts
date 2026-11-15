import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------ AUTH / USERS ------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // admin | user
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("user_sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/* --------------------------- TELEGRAM CHANNELS ---------------------------- */

export const channels = pgTable(
  "telegram_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    tgId: text("tg_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Other"),
    language: text("language").notNull().default("en"),
    subscribers: integer("subscribers").notNull().default(0),
    inviteUrl: text("invite_url").notNull().default(""),
    isDemo: boolean("is_demo").notNull().default(true),
    source: text("source").notNull().default("demo"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    lastAnalysedAt: timestamp("last_analysed_at", { withTimezone: true }),
  },
  (t) => [index("channels_category_idx").on(t.category), index("channels_subs_idx").on(t.subscribers)]
);

export const posts = pgTable(
  "channel_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    messageId: integer("message_id").notNull(),
    text: text("text").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    views: integer("views"),
    reactions: integer("reactions"),
    comments: integer("comments"), // nullable = unavailable, NOT zero
    forwards: integer("forwards"),
    isPromo: boolean("is_promo").notNull().default(false),
    url: text("url").notNull().default(""),
  },
  (t) => [index("posts_channel_idx").on(t.channelId), index("posts_date_idx").on(t.publishedAt)]
);

export const statsSnapshots = pgTable(
  "channel_statistics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    subscribers: integer("subscribers").notNull(),
    avgViews: integer("avg_views"),
    engagementRate: real("engagement_rate"),
    viewsRate: real("views_rate"),
  },
  (t) => [index("stats_channel_idx").on(t.channelId)]
);

export const scores = pgTable("channel_analytics", {
  channelId: uuid("channel_id")
    .primaryKey()
    .references(() => channels.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  avgViews: integer("avg_views"),
  medianViews: integer("median_views"),
  viewsRate: real("views_rate"),
  engagementRate: real("engagement_rate"),
  avgReactions: real("avg_reactions"),
  avgComments: real("avg_comments"), // null when comments unavailable
  avgForwards: real("avg_forwards"),
  postingFrequency: real("posting_frequency"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  qualityScore: integer("quality_score"),
  qualityFlags: jsonb("quality_flags").$type<{ code: string; severity: string; evidence: string }[]>(),
  adScore: integer("ad_score"),
  adBreakdown: jsonb("ad_breakdown").$type<Record<string, { points: number; max: number; reason: string }>>(),
  adClass: text("ad_class"),
});

/* ------------------------------ DISCOVERY --------------------------------- */

export const discoveryJobs = pgTable(
  "discovery_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    relatedKeywords: jsonb("related_keywords").$type<string[]>().notNull().default([]),
    options: jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("queued"), // queued|running|completed|failed|cancelled
    phase: text("phase").notNull().default("Queued"),
    progress: integer("progress").notNull().default(0),
    sources: jsonb("sources")
      .$type<{ key: string; label: string; status: string; detail?: string; found: number }[]>()
      .notNull()
      .default([]),
    channelsDiscovered: integer("channels_discovered").notNull().default(0),
    channelsAnalysed: integer("channels_analysed").notNull().default(0),
    error: text("error"),
    bestChannelId: uuid("best_channel_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("jobs_user_idx").on(t.userId)]
);

export const jobResults = pgTable(
  "search_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => discoveryJobs.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    skipped: boolean("skipped").notNull().default(false),
    skipReason: text("skip_reason"),
  },
  (t) => [uniqueIndex("job_channel_unique").on(t.jobId, t.channelId), index("results_job_idx").on(t.jobId)]
);

/* ----------------------------- SAVED CHANNELS ----------------------------- */

export const folders = pgTable("channel_folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedChannels = pgTable(
  "saved_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    adPriceCents: integer("ad_price_cents"),
    currency: text("currency").notNull().default("USD"),
    contactUsername: text("contact_username"),
    contacted: boolean("contacted").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    monitorInterval: text("monitor_interval").notNull().default("off"), // off|24h|3d|7d|manual
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
    lastSubscribers: integer("last_subscribers"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_user_channel_unique").on(t.userId, t.channelId)]
);

/* ------------------------------- ADVERTISING ------------------------------ */

export const adPrices = pgTable("advertising_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelName: text("channel_name").notNull(),
  username: text("username").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  contactUsername: text("contact_username").notNull().default(""),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  duration: text("duration").notNull().default("24h"),
  format: text("format").notNull().default("sponsored_post"),
  expectedViews: integer("expected_views"),
  actualViews: integer("actual_views"),
  campaignDate: text("campaign_date").notNull().default(""),
  results: text("results").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("advertising_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  product: text("product").notNull().default(""),
  targetKeywords: jsonb("target_keywords").$type<string[]>().notNull().default([]),
  budgetCents: integer("budget_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  status: text("status").notNull().default("draft"), // draft|active|paused|completed
  notes: text("notes").notNull().default(""),
  spendCents: integer("spend_cents").notNull().default(0),
  expectedViews: integer("expected_views").notNull().default(0),
  actualViews: integer("actual_views").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignChannels = pgTable(
  "campaign_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("campaign_channel_unique").on(t.campaignId, t.channelId)]
);

export const competitorAds = pgTable("competitor_ads", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
  advertiserText: text("advertiser_text").notNull(),
  link: text("link").notNull().default(""),
  product: text("product").notNull().default(""),
  occurrences: integer("occurrences").notNull().default(1),
  notes: text("notes").notNull().default(""),
  isDemo: boolean("is_demo").notNull().default(true),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------ SYSTEM ------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_user_idx").on(t.userId)]
);

export const systemLogs = pgTable(
  "system_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    level: text("level").notNull().default("info"), // info|warn|error
    source: text("source").notNull(),
    message: text("message").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("logs_time_idx").on(t.createdAt)]
);

export const apiConfigurations = pgTable("api_configurations", {
  id: text("id").primaryKey().default("telegram"),
  apiId: text("api_id"),
  apiHashCipher: text("api_hash_cipher"),
  sessionCipher: text("session_cipher"),
  status: text("status").notNull().default("not_configured"), // not_configured|configured|error
  notes: text("notes").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("application_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
