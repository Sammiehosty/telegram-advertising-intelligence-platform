# TeleAd Intelligence deployment

## Architecture

- Next.js 16 frontend on Vercel.
- PHP REST API on `teleads.sammiehosty.com`.
- MySQL/MariaDB database behind the PHP API.
- Python Telethon worker on a VPS or other persistent worker host.

## Vercel

1. Import `Sammiehosty/telegram-advertising-intelligence-platform`.
2. Use the repository root as the Vercel Root Directory.
3. Select the Next.js framework preset.
4. Use `npm install` as the install command and `npm run build` as the build command.
5. Add `TELEAD_PHP_API_URL=https://teleads.sammiehosty.com/api` to Production, Preview and Development environment variables.
6. Redeploy after saving the environment variable.

No `DATABASE_URL` is required by the frontend build. The frontend sends requests to same-origin `/api/*` paths; Next.js rewrites those requests to the PHP API.

## PHP API

Deploy the PHP backend separately. Configure its database credentials and secrets in the private `config.local.php` file on the hosting server. Never commit that file.

Check:

```
https://teleads.sammiehosty.com/api/health
```

It should return JSON with `ok: true` and `database: connected`.

## Telegram worker

Run the Telethon worker on a persistent VPS/worker environment, not as a Vercel function. Configure its API endpoint and worker secret securely. It imports collected channel metadata through the PHP API.

## Security and release checks

- Keep secrets out of Git and Vercel source files.
- Use HTTPS for the frontend and API.
- Test registration, login, logout, dashboard loading, channel browsing, saved channels and campaign operations after deployment.
- Register the first account immediately after initializing the database if the first account is assigned administrator privileges.
