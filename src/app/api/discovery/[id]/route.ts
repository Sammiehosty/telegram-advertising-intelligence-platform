import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { discoveryJobs } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET — job meta for progress polling. Admin may view all, users their own. */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const rows = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, id)).limit(1);
  const jobFound = rows[0];
  if (!jobFound) return jsonError(404, "Search job not found.");
  if (jobFound.userId !== user.id && user.role !== "admin") return jsonError(403, "Not your search.");
  return NextResponse.json({ ok: true, job: jobFound });
}

/** DELETE — remove a search and its results from history. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const rows = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, id)).limit(1);
  if (!rows[0]) return jsonError(404, "Search job not found.");
  if (rows[0].userId !== user.id && user.role !== "admin") return jsonError(403, "Not your search.");
  await db.delete(discoveryJobs).where(eq(discoveryJobs.id, id));
  return NextResponse.json({ ok: true });
}
