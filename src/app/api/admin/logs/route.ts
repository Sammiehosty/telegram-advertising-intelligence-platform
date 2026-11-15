import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { systemLogs } from "@/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/api";

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  const rows = await db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt)).limit(100);
  return NextResponse.json({ ok: true, logs: rows });
}
