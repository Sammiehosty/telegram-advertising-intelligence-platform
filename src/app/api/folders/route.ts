import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { folders } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const rows = await db.select().from(folders).where(eq(folders.userId, user.id));
  return NextResponse.json({ ok: true, folders: rows });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const name = str(body.name, 60);
  if (!name) return jsonError(400, "Folder name is required.");
  const rows = await db.insert(folders).values({ userId: user.id, name }).returning();
  return NextResponse.json({ ok: true, folder: rows[0] });
}
