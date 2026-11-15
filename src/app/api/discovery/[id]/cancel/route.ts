import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { discoveryJobs } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const rows = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, id)).limit(1);
  if (!rows[0]) return jsonError(404, "Search job not found.");
  if (rows[0].userId !== user.id && user.role !== "admin") return jsonError(403, "Not your search.");
  if (rows[0].status === "running" || rows[0].status === "queued") {
    await db.update(discoveryJobs).set({ status: "cancelled", phase: "Cancelling…" }).where(eq(discoveryJobs.id, id));
  }
  return NextResponse.json({ ok: true });
}
