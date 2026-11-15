import { NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, campaignChannels } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const rows = await db
    .select({
      id: campaigns.id, name: campaigns.name, product: campaigns.product,
      targetKeywords: campaigns.targetKeywords, budgetCents: campaigns.budgetCents,
      currency: campaigns.currency, startDate: campaigns.startDate, endDate: campaigns.endDate,
      status: campaigns.status, notes: campaigns.notes, spendCents: campaigns.spendCents,
      expectedViews: campaigns.expectedViews, actualViews: campaigns.actualViews,
      clicks: campaigns.clicks, conversions: campaigns.conversions, createdAt: campaigns.createdAt,
      channelCount: sql<number>`(select count(*)::int from campaign_channels cc where cc.campaign_id = ${campaigns.id})`,
    })
    .from(campaigns)
    .where(eq(campaigns.userId, user.id))
    .orderBy(desc(campaigns.createdAt));
  return NextResponse.json({ ok: true, campaigns: rows });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const name = str(body.name, 120);
  if (!name) return jsonError(400, "Campaign name is required.");
  const budget = typeof body.budget === "number" ? body.budget : parseFloat(body.budget ?? "0");
  const rows = await db
    .insert(campaigns)
    .values({
      userId: user.id,
      name,
      product: str(body.product, 200),
      targetKeywords: Array.isArray(body.targetKeywords)
        ? body.targetKeywords.map((k: unknown) => str(k, 60)).filter(Boolean).slice(0, 20)
        : [],
      budgetCents: Number.isFinite(budget) ? Math.round(Math.max(0, budget) * 100) : 0,
      currency: str(body.currency, 8) || "USD",
      startDate: str(body.startDate, 20),
      endDate: str(body.endDate, 20),
      status: ["draft", "active", "paused", "completed"].includes(body.status) ? body.status : "draft",
      notes: str(body.notes, 2000),
    })
    .returning();
  return NextResponse.json({ ok: true, campaign: rows[0] });
}
