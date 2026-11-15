# TeleAd Intelligence — Deployment Guide

Target: Ubuntu 22.04 / 24.04 VPS, Node 20+, PostgreSQL 14+ (Drizzle), Nginx, systemd, SSL.

## 1. System packages

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y curl nginx postgresql postgresql-contrib python3.11 python3.11-venv certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER telead WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE telead OWNER telead;
SQL
```

> PostgreSQL is the only database adapter configured in this project. MySQL is not currently a
> drop-in deployment option.

## 3. Application

```bash
sudo mkdir -p /opt/telead && sudo chown $USER /opt/telead
cd /opt/telead && git clone <your-repo> .   # or rsync the project
cp .env.example .env && nano .env           # DATABASE_URL, APP_SECRET (openssl rand -hex 32)
npm ci
npm run db:push                             # schema → database
SEED_ADMIN_EMAIL=admin@yourdomain.com SEED_ADMIN_PASSWORD="use-a-unique-password-of-12+-chars" npm run db:seed
npm run build
```

## 4. systemd service

`/etc/systemd/system/telead.service`:

```ini
[Unit]
Description=TeleAd Intelligence
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/telead
EnvironmentFile=/opt/telead/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=4
User=www-data
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now telead
```

## 5. Telethon worker (live Telegram scraping)

```bash
python3.11 -m venv /opt/telead/.venv && /opt/telead/.venv/bin/pip install -r workers/requirements.txt
export TELEGRAM_API_ID=… TELEGRAM_API_HASH=…
/opt/telead/.venv/bin/python workers/telethon_worker.py login   # prints StringSession
# paste session into the web app: Administration → Telegram API
```

The worker is invoked on demand by jobs/cron; keep it warm with a small systemd unit or call it
from cron pipelines (`search`, `analyse` subcommands print JSONL).

## 6. Nginx reverse proxy + SSL

```nginx
server {
    listen 80;
    server_name telead.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    client_max_body_size 5m;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/telead /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d telead.example.com
```

## 7. Monitoring cron (Section 17)

The app re-checks monitored saved channels lazily on dashboard load, plus a hardened endpoint
for real cron:

```bash
*/15 * * * * curl -fsS -H "x-cron-secret: $APP_SECRET" https://telead.example.com/api/cron/monitor >> /var/log/telead-cron.log 2>&1
```

Alerts land in the in-app notification bell; drift ≥3% on subscribers triggers a monitor alert.

## 8. Hardening checklist

- [ ] `APP_SECRET` rotated from default; `.env` permissions `600`
- [ ] Unique admin password supplied through SEED_ADMIN_PASSWORD (never use a sample/default password)
- [ ] Telegram credentials entered via UI (encrypted at rest, AES-256-GCM)
- [ ] HTTPS enforced (certbot auto-redirect), `secure` session cookies active in production
- [ ] PostgreSQL not exposed publicly (`listen_addresses = localhost`)
- [ ] OS firewall: allow 80/443 only

## Acceptance checklist

1. Register → admin role granted, dashboard loads
2. Discover "Cryptocurrency" → progress sources visible, cancel works, results scored
3. Results table: sort, save, compare, copy link, CSV export, campaign attach
4. Channel page: metrics, score breakdown, quality flags, posts, history chart
5. Compare 2+ channels → best-value highlighting + recommendation
6. Saved channels: folders, tags, notes, monitoring interval
7. Campaigns + price tracker CPM math
8. Competitor scan → save examples
9. History: repeat / delete / export
10. Reports: preview + CSV + print-to-PDF
11. Admin: users, Telegram config, weights, providers, logs
