# TeleAd Intelligence

Telegram advertising intelligence platform for discovering, analysing, comparing and tracking Telegram channels and advertising opportunities.

## Deployment architecture

- **Frontend:** Next.js 16 / React 19 deployed on Vercel.
- **Backend API:** PHP REST API hosted at https://teleads.sammiehosty.com.
- **Database:** MySQL / MariaDB.
- **Telegram collection:** Separate Python Telethon worker.

The Next.js frontend does not connect directly to MySQL and does not require a `DATABASE_URL`. All application API requests under `/api/*` are forwarded by `next.config.ts` to the PHP backend.

## Vercel configuration

Set this environment variable for Production, Preview and Development:

```
TELEAD_PHP_API_URL=https://teleads.sammiehosty.com/api
```

Build command:

```
npm run build
```

Install command:

```
npm install
```

Framework preset: **Next.js**. Root directory: repository root.

## PHP backend

The PHP backend is deployed separately to the document root of `teleads.sammiehosty.com`. Its health endpoint is:

```
https://teleads.sammiehosty.com/api/health
```

Do not commit `php-backend/config.local.php`, database passwords, Telegram session strings, API keys, or other secrets.

## Important

The Telegram worker is a separate process and must be configured and run independently. The PHP API serves indexed channel data; it does not run long-lived Telegram scraping jobs inside Vercel.
