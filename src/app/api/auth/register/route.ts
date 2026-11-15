import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, createSession, validEmail } from "@/lib/auth";
import { str, jsonError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = str(body.name, 80);
    const email = str(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!name) return jsonError(400, "Please enter your name.");
    if (!validEmail(email)) return jsonError(400, "Please enter a valid email address.");
    if (password.length < 8) return jsonError(400, "Password must be at least 8 characters.");

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) return jsonError(409, "An account with this email already exists.");

    // First registered account becomes the administrator.
    const totalRows = await db.select({ value: count() }).from(users);
    const role = (totalRows[0]?.value ?? 0) === 0 ? "admin" : "user";

    const inserted = await db
      .insert(users)
      .values({ name, email, passwordHash: hashPassword(password), role })
      .returning({ id: users.id });
    await createSession(inserted[0].id);
    return NextResponse.json({ ok: true, user: { id: inserted[0].id, name, email, role } });
  } catch (err) {
    console.error(err);
    return jsonError(500, "Registration failed. Please try again.");
  }
}
