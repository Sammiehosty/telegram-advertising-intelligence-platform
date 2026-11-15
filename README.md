# TeleAd Intelligence

**Discover. Analyse. Advertise Smarter.**

A production-grade Telegram channel discovery, scraping, analytics and advertising-intelligence
platform. Advertisers enter a keyword, the multi-source discovery engine finds public Telegram
channels, the analytics engine computes engagement economics, and the scoring engine ranks which
channels are actually worth paying for.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Next.js 16 (App Router, React 19, TypeScript, Tailwind v4)         │
│  ├─ UI: 12 workspace sections, dark-first design system            │
│  ├─ API routes: auth, discovery, channels, saved, campaigns,       │
│  │   prices, competitors, compare, dashboard, admin, reports, cron │
│  └─ Background discovery runner (in-process, DB-backed job queue)  │
├────────────────────────────────────────────────────────────────────┤
│ PostgreSQL (Drizzle ORM) — 16 relational tables, FKs, unique       │
│ constraints, historical statistics snapshots                       │
├────────────────────────────────────────────────────────────────────┤
│ workers/telethon_worker.py — Telethon MTProto service for live     │
│ Telegram search/scraping (login, search, analyse commands)         │
└────────────────────────────────────────────────────────────────────┘
```

### Modular discovery pipeline

Every source is an isolated provider in `src/lib/discovery.ts`:

| Provider | Behaviour |
|---|---|
| **Telegram Global Search (MTProto)** | Live resolution via the Telethon worker session. Honest status reporting — skipped until credentials exist; never fakes results. |
| **Public Directory & Search-Engine Scan** | Finds publicly indexed `t.me` links (search-engine discovery). Live usernames land as `isDemo=false` records, marked *pending live stats* until the Telegram API is connected. |
| **Sample Corpus Provider** | Deterministic, seeded demonstration dataset so the entire pipeline (dedupe → analysis → scoring → comparison → export) is fully functional out of the box. Every demo channel is flagged **Sample data** in the UI and `is_demo=1` in the DB. Demo and live data are never mixed. |

Add new providers by implementing one async function and registering it — the runner, progress
tracking, dedupe and cancellation are shared.

### Scoring engines

- **Metrics** (`src/lib/scoring.ts`): avg/median views, views rate, engagement rate
  `((avgReactions + avgComments) / subscribers) × 100`, posting frequency, last activity.
  Unavailable metrics are `null` — never silently zero.
- **Quality score (0–100)**: evidence-based flags — very low views vs subscribers, irregular
  posting (gap CV), view volatility, dormancy, repetitive content, unusual engagement. Bands:
  90+ Excellent · 75–89 Very Good · 60–74 Average · 40–59 Poor · <40 High Risk.
- **Advertising Potential (0–100)**: relevance 30 · avg views 20 · engagement 20 · consistency 15 ·
  recency 10 · audience suitability 5 — every point explained, all weights admin-configurable.

---

## Quick start (this repository)

```bash
cp .env.example .env          # set DATABASE_URL + APP_SECRET
npm install
npm run db:push               # create tables
SEED_ADMIN_EMAIL=admin@yourdomain.com SEED_ADMIN_PASSWORD="use-a-unique-password-of-12+-chars" npm run db:seed
npm run build && npm start    # http://localhost:3000
```

First registered account becomes admin automatically; the seed script is the recommended path.

---

## Typed API summary

All endpoints are REST JSON under `/api`, session-cookie authenticated (httpOnly, 7-day sessions,
bcrypt password hashing v12). Full reference: [docs/API.md](docs/API.md).

```
POST /api/auth/register | login | logout          GET /api/auth/me
POST /api/discovery                               GET /api/discovery            (history)
GET  /api/discovery/:id  | :id/results | :id/export (CSV)
POST /api/discovery/:id/cancel                    DELETE /api/discovery/:id
GET  /api/channels?query&category&sort&page       GET /api/channels/:id
POST /api/channels/:id/analyse?period=30
GET/POST /api/saved      PATCH/DELETE /api/saved/:id        GET/POST /api/folders
GET/POST /api/campaigns  GET/PATCH/DELETE /api/campaigns/:id (attach/detach channels)
GET/POST/DELETE /api/prices                         (ad price tracker, CPM math)
POST /api/competitors/scan  GET/POST/DELETE /api/competitors
POST /api/compare                                 (rule-based or AI narrative)
GET  /api/dashboard     GET/POST /api/notifications
GET/PUT /api/settings   (profile / password / preferences)
GET  /api/admin         PATCH/DELETE /api/admin/users/:id
GET/PUT /api/admin/telegram   GET/PUT /api/admin/settings   GET /api/admin/logs
GET  /api/cron/monitor  (header: x-cron-secret)     GET /api/health
```

## Live Telegram integration (honest path)

Telegram provides **no unrestricted global keyword search on the public web**. The platform
therefore splits capability honestly:

1. Admin stores `api_id` / `api_hash` / Telethon `StringSession` (AES-256-GCM at rest, never
   returned to the frontend).
2. `workers/telethon_worker.py` (Telethon) performs MTProto search & scraping with FloodWait
   respect, throttling and retry. JSONL output feeds the discovery pipeline on a VPS.
3. Directory provider discovers public `t.me` links indexed by search engines.
4. User-submitted links can be entered via Discovery → username keywords.

Until credentials are configured, the sample provider keeps the product fully explorable with
clearly-flagged demo data.

## Testing

```bash
npm run typecheck        # TypeScript strict pass over app + tests
npx next typegen         # route type generation
npm run build            # production build
# Seed creates demonstration accounts only; all sample channels carry is_demo=1
# and "Sample data" badges — never mixed with live provider output.
```

Manual acceptance checklist lives in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#acceptance-checklist).

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Ubuntu 22.04/24.04, Node 20+, PostgreSQL/MySQL
adapter notes, Nginx reverse proxy, SSL via certbot, systemd units, cron for monitoring, and the
optional Telethon worker unit.
