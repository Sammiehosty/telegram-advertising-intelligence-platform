import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, campaignChannels, channels, scores } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

async function ownCampaign(userId: string, id: string) {
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!rows[0] || rows[0].userId !== userId) return null;
  return rows[0];
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const campaign = await ownCampaign(user.id, id);
  if (!campaign) return jsonError(404, "Campaign not found.");
  const chRows = await db
    .select({
      id: campaignChannels.id,
      channelId: campaignChannels.channelId,
      priceCents: campaignChannels.priceCents,
      title: channels.title, username: channels.username,
      subscribers: channels.subscribers, avgViews: scores.avgViews,
      adScore: scores.adScore, engagementRate: scores.engagementRate,
    })
    .from(campaignChannels)
    .innerJoin(channels, eq(campaignChannels.channelId, channels.id))
    .leftJoin(scores, eq(campaignChannels.channelId, scores.channelId))
    .where(eq(campaignChannels.campaignId, id));
  return NextResponse.json({ ok: true, campaign, channels: chRows });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const campaign = await ownCampaign(user.id, id);
  if (!campaign) return jsonError(404, "Campaign not found.");
  const body = await req.json().catch(() => ({}));

  if (body.action === "addChannel") {
    const channelId = str(body.channelId, 64);
    const price = typeof body.price === "number" ? body.price : parseFloat(body.price ?? "0");
    if (!channelId) return jsonError(400, "channelId required.");
    await db.insert(campaignChannels).values({
      campaignId: id, channelId,
      priceCents: Number.isFinite(price) ? Math.round(Math.max(0, price) * 100) : 0,
    }).onConflictDoNothing();
    return NextResponse.json({ ok: true });
  }
  if (body.action === "removeChannel") {
    await db.delete(campaignChannels).where(and(eq(campaignChannels.campaignId, id), eq(campaignChannels.channelId, str(body.channelId, 64))));
    return NextResponse.json({ ok: true });
  }

  const patch: Partial<typeof campaigns.$inferInsert> = {};
  if (body.name !== undefined) patch.name = str(body.name, 120) || campaign.name;
  if (body.product !== undefined) patch.product = str(body.product, 200);
  if (body.notes !== undefined) patch.notes = str(body.notes, 2000);
  if (body.status !== undefined && ["draft", "active", "paused", "completed"].includes(body.status)) patch.status = body.status;
  if (body.startDate !== undefined) patch.startDate = str(body.startDate, 20);
  if (body.endDate !== undefined) patch.endDate = str(body.endDate, 20);
  const moneyFields: [string, "budgetCents" | "spendCents"][] = [["budget", "budgetCents"], ["spend", "spendCents"]];
  for (const [inKey, outKey] of moneyFields) {
    if (body[inKey] !== undefined) {
      const v = typeof body[inKey] === "number" ? body[inKey] : parseFloat(body[inKey]);
      patch[outKey] = Number.isFinite(v) ? Math.round(Math.max(0, v) * 100) : 0;
    }
  }
  const intFields: [string, "expectedViews" | "actualViews" | "clicks" | "conversions"][] = [
    ["expectedViews", "expectedViews"], ["actualViews", "actualViews"], ["clicks", "clicks"], ["conversions", "conversions"],
  ];
  for (const [inKey, outKey] of intFields) {
    if (body[inKey] !== undefined) {
      const v = typeof body[inKey] === "number" ? body[inKey] : parseInt(body[inKey], 10);
      patch[outKey] = Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    }
  }
  await db.update(campaigns).set(patch).where(eq(campaigns.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const campaign = await ownCampaign(user.id, id);
  if (!campaign) return jsonError(404, "Campaign not found.");
  await db.delete(campaigns).where(eq(campaigns.id, id));
  return NextResponse.json({ ok: true });
}
