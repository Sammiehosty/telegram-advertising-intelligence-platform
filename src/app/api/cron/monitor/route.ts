import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { runMonitorPassForUser } from "@/lib/discovery";

/**
 * GET /api/cron/monitor — VPS cron entrypoint for Section 17 monitoring.
 * Protect with a header secret:
 *   curl -fsS -H "x-cron-secret: $APP_SECRET" https://your-domain/api/cron/monitor
 * Crontab example (every 15 minutes):
 *   star-slash-15 * * * * curl -fsS -H "x-cron-secret: ..." https://example.com/api/cron/monitor
 */
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  const expected = process.env.APP_SECRET || "telead-dev-secret-change-in-production";
  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const users = await db.execute(
    sql`select distinct user_id from saved_channels where monitor_interval <> 'off'`
  );
  let checked = 0;
  for (const row of users.rows as { user_id: string }[]) {
    checked += await runMonitorPassForUser(row.user_id);
  }
  return NextResponse.json({ ok: true, usersChecked: (users.rows as unknown[]).length, channelsChecked: checked });
}
