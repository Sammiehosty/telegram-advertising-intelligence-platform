# TeleAd Intelligence — API Reference

Base URL: `/api`. Auth: httpOnly session cookie (`telead_session`, 7 days), bcrypt-hashed
passwords, role-based (`admin` | `user`). Errors are JSON: `{ "ok": false, "error": "…" }` with
sensible HTTP statuses. Raw server errors are never exposed.

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{name, email, password}` | First account → `admin` role. Logs in immediately. |
| POST | `/auth/login` | `{email, password}` | Constant response for bad email/password. |
| POST | `/auth/logout` | — | Destroys server session + cookie. |
| GET | `/auth/me` | — | Current user or 401. |

## Discovery

| Method | Path | Description |
|---|---|---|
| POST | `/discovery` | `{keyword, relatedKeywords[], limit(20/50/100/250/500), periodDays(7..90), filters{minSubs,maxSubs,minAvgViews,minER,maxER,activeWithinDays,minFreq,maxFreq,category,language}}` → `{jobId}`. Runs in background. |
| GET | `/discovery` | Search history (your jobs + best channel). |
| GET | `/discovery/:id` | Job meta for polling: `status`, `phase`, `progress`, per-source statuses, counters. |
| GET | `/discovery/:id/results` | Joined channel rows with scores. Filtered-out rows carry `skipReason`. |
| POST | `/discovery/:id/cancel` | Cooperative cancellation (checked per channel). |
| DELETE | `/discovery/:id` | Removes job + results from history. |
| GET | `/discovery/:id/export` | CSV download of the full session. |

## Channels

| Method | Path | Description |
|---|---|---|
| GET | `/channels` | `?query&category&sort(subscribers,avgViews,engagement,quality,adScore,recent,title)&page` |
| GET | `/channels/:id` | Full payload: channel, score breakdown, quality flags, posts, history snapshots, weights. |
| POST | `/channels/:id/analyse?period=30` | Re-run the analysis engine. Live channels require Telegram config (honest 409 otherwise). |

## Workspace

| Method | Path | Description |
|---|---|---|
| GET/POST | `/saved` | List (with folders) / save `{channelId}` — dup-safe unique constraint. |
| PATCH/DELETE | `/saved/:id` | notes, tags, folder, price, currency, contact, contacted, verified, monitorInterval. |
| GET/POST | `/folders` | Saved-channel folders. |
| GET/POST | `/campaigns` | List with channel counts / create. |
| GET/PATCH/DELETE | `/campaigns/:id` | Detail + attached channels; PATCH fields or `action: addChannel/removeChannel`; metric updates (spend, views, clicks, conversions). |
| GET/POST | `/prices` | Ad price tracker. DELETE `/prices?id=`. CPM computed client + report side. |
| GET/POST/DELETE | `/competitors` | Saved public ad examples. |
| POST | `/competitors/scan` | `{keyword?}` — scans **publicly collected** posts for promo markers. Never private data. |
| POST | `/compare` | `{channelIds[2..10]}` → rows, winner, recommendation. Uses configured AI endpoint when present, else the deterministic rule engine (`engine` field tells you which). |

## System

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Stat cards, chart series, recent searches, top opportunities. Also triggers lazy monitoring. |
| GET/POST | `/notifications` | Latest + unread count / mark all read. |
| GET/PUT | `/settings` | Prefs; `action: password` (change), `prefs`, `name`. |
| GET | `/admin` | System status (DB, queue, Telegram), counts, user list. Admin only. |
| PATCH/DELETE | `/admin/users/:id` | Role change / delete with last-admin guards. |
| GET/PUT | `/admin/telegram` | Masked config state / save credentials (AES-256-GCM). `clear:true` removes. |
| GET/PUT | `/admin/settings` | Scoring weights, provider toggles, analysis defaults, AI integration. |
| GET | `/admin/logs` | Latest 100 system log entries. |
| GET | `/cron/monitor` | Requires `x-cron-secret: $APP_SECRET`. Re-checks due monitored channels. |
| GET | `/health` | Liveness + DB reachability. |

## VPS worker\n\nThe persistent Telethon process polls the PHP API for queued `discovery_jobs`. It sends an authenticated `POST /worker/heartbeat` every 15 seconds, claims jobs through `POST /worker/claim`, imports public channel metadata, and reports progress/completion. The admin connection test considers the worker online only when its heartbeat is no older than 45 seconds.\n\n## Rate limiting & safety

- Discovery runner throttles provider work and writes progress to the DB (worker-agnostic).
- The Telethon worker respects `FloodWaitError` cooldowns and reports its authenticated VPS/Telegram connection state through worker heartbeats.
- All writes are parameterised (Drizzle). Inputs are validated/sanitised server-side.
- Telegram and AI secrets are encrypted with AES-256-GCM (`APP_SECRET` derived key) and never
  serialised to the client.
