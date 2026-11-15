import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { adPrices } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const rows = await db.select().from(adPrices).where(eq(adPrices.userId, user.id)).orderBy(desc(adPrices.createdAt));
  return NextResponse.json({ ok: true, prices: rows });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const channelName = str(body.channelName, 120);
  if (!channelName) return jsonError(400, "Channel name is required.");
  const price = typeof body.price === "number" ? body.price : parseFloat(body.price ?? "0");
  const rows = await db
    .insert(adPrices)
    .values({
      userId: user.id,
      channelName,
      username: str(body.username, 64).replace(/^@/, ""),
      contactName: str(body.contactName, 120),
      contactUsername: str(body.contactUsername, 64).replace(/^@/, ""),
      priceCents: Number.isFinite(price) ? Math.round(Math.max(0, price) * 100) : 0,
      currency: str(body.currency, 8) || "USD",
      duration: str(body.duration, 40) || "24h",
      format: str(body.format, 40) || "sponsored_post",
      expectedViews: parseInt(body.expectedViews, 10) || null,
      actualViews: parseInt(body.actualViews, 10) || null,
      campaignDate: str(body.campaignDate, 20),
      results: str(body.results, 1000),
    })
    .returning();
  return NextResponse.json({ ok: true, price: rows[0] });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError(400, "id required.");
  await db.delete(adPrices).where(and(eq(adPrices.id, id), eq(adPrices.userId, user.id)));
  return NextResponse.json({ ok: true });
}
