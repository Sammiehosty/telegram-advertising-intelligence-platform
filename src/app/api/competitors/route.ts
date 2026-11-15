import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { competitorAds, channels } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const rows = await db
    .select({
      id: competitorAds.id, advertiserText: competitorAds.advertiserText,
      link: competitorAds.link, product: competitorAds.product,
      occurrences: competitorAds.occurrences, notes: competitorAds.notes,
      isDemo: competitorAds.isDemo, firstSeen: competitorAds.firstSeen,
      channelTitle: channels.title, channelUsername: channels.username,
    })
    .from(competitorAds)
    .leftJoin(channels, eq(competitorAds.channelId, channels.id))
    .where(eq(competitorAds.userId, user.id))
    .orderBy(desc(competitorAds.firstSeen));
  return NextResponse.json({ ok: true, ads: rows });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const advertiserText = str(body.advertiserText, 1000);
  if (!advertiserText) return jsonError(400, "Advertisement text is required.");
  const rows = await db
    .insert(competitorAds)
    .values({
      userId: user.id,
      channelId: str(body.channelId, 64) || null,
      advertiserText,
      link: str(body.link, 500),
      product: str(body.product, 200),
      notes: str(body.notes, 1000),
      isDemo: !!body.isDemo,
    })
    .returning();
  return NextResponse.json({ ok: true, ad: rows[0] });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError(400, "id required.");
  await db.delete(competitorAds).where(and(eq(competitorAds.id, id), eq(competitorAds.userId, user.id)));
  return NextResponse.json({ ok: true });
}
