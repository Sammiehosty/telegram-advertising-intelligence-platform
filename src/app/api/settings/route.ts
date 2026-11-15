import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";

export type UserPrefs = { defaultPeriodDays: number; theme: "dark" | "light" };

/** GET — user preferences. */
export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const prefs = await getSetting<UserPrefs>(`prefs:${user.id}`, { defaultPeriodDays: 30, theme: "dark" });
  return NextResponse.json({ ok: true, prefs });
}

/** PUT — change password or update preferences. */
export async function PUT(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));

  if (body.action === "password") {
    const current = typeof body.current === "string" ? body.current : "";
    const next = typeof body.next === "string" ? body.next : "";
    if (next.length < 8) return jsonError(400, "New password must be at least 8 characters.");
    const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!rows[0] || !verifyPassword(current, rows[0].passwordHash)) {
      return jsonError(400, "Current password is incorrect.");
    }
    await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, user.id));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "prefs") {
    const prefs = await getSetting<UserPrefs>(`prefs:${user.id}`, { defaultPeriodDays: 30, theme: "dark" });
    const nextPrefs: UserPrefs = { ...prefs };
    if ([7, 14, 30, 60, 90].includes(body.defaultPeriodDays)) nextPrefs.defaultPeriodDays = body.defaultPeriodDays;
    if (body.theme === "dark" || body.theme === "light") nextPrefs.theme = body.theme;
    await setSetting(`prefs:${user.id}`, nextPrefs);
    return NextResponse.json({ ok: true, prefs: nextPrefs });
  }

  if (body.action === "name") {
    const name = str(body.name, 80);
    if (!name) return jsonError(400, "Name cannot be empty.");
    await db.update(users).set({ name }).where(eq(users.id, user.id));
    return NextResponse.json({ ok: true });
  }

  return jsonError(400, "Unknown settings action.");
}
