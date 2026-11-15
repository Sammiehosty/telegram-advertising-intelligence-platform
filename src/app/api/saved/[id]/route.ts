import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { savedChannels } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str, intOr } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof savedChannels.$inferInsert> = {};
  if (body.notes !== undefined) patch.notes = str(body.notes, 2000);
  if (Array.isArray(body.tags)) patch.tags = body.tags.map((t: unknown) => str(t, 40)).filter(Boolean).slice(0, 12);
  if (body.folderId !== undefined) patch.folderId = body.folderId ? str(body.folderId, 64) : null;
  if (body.contacted !== undefined) patch.contacted = !!body.contacted;
  if (body.verified !== undefined) patch.verified = !!body.verified;
  if (body.contactUsername !== undefined) patch.contactUsername = str(body.contactUsername, 64).replace(/^@/, "");
  if (body.currency !== undefined) patch.currency = str(body.currency, 8) || "USD";
  if (body.adPrice !== undefined) {
    const price = typeof body.adPrice === "number" ? body.adPrice : parseFloat(body.adPrice);
    patch.adPriceCents = Number.isFinite(price) ? Math.round(price * 100) : null;
  }
  if (body.monitorInterval !== undefined && ["off", "24h", "3d", "7d", "manual"].includes(body.monitorInterval)) {
    patch.monitorInterval = body.monitorInterval;
    const hours = body.monitorInterval === "24h" ? 24 : body.monitorInterval === "3d" ? 72 : body.monitorInterval === "7d" ? 168 : 0;
    patch.nextCheckAt = hours ? new Date(Date.now() + hours * 3600_000) : null;
  }
  if (!Object.keys(patch).length) return jsonError(400, "Nothing to update.");
  const res = await db
    .update(savedChannels)
    .set(patch)
    .where(and(eq(savedChannels.id, id), eq(savedChannels.userId, user.id)))
    .returning({ id: savedChannels.id });
  if (!res[0]) return jsonError(404, "Saved channel not found.");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  await db.delete(savedChannels).where(and(eq(savedChannels.id, id), eq(savedChannels.userId, user.id)));
  return NextResponse.json({ ok: true });
}
