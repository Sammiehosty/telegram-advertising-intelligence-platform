import { NextResponse } from "next/server";
import { eq, ne, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin, isErrorResponse, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (!["admin", "user"].includes(body.role)) return jsonError(400, "Role must be admin or user.");
  if (body.role === "user") {
    const admins = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(eq(users.role, "admin"), ne(users.id, id)));
    if ((admins[0]?.n ?? 0) === 0) return jsonError(400, "Cannot demote the last administrator.");
  }
  await db.update(users).set({ role: body.role }).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  const { id } = await ctx.params;
  if (id === admin.id) return jsonError(400, "You cannot delete your own account.");
  const target = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target[0]) return jsonError(404, "User not found.");
  if (target[0].role === "admin") {
    const admins = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(eq(users.role, "admin"), ne(users.id, id)));
    if ((admins[0]?.n ?? 0) === 0) return jsonError(400, "Cannot delete the last administrator.");
  }
  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
