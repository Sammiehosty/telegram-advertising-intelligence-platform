import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbOk = false;
  }
  return NextResponse.json({ ok: true, service: "telead-intelligence", database: dbOk ? "up" : "down" });
}
