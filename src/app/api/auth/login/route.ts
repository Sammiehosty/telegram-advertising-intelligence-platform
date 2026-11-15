import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession } from "@/lib/auth";
import { str, jsonError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = str(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return jsonError(400, "Email and password are required.");

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    // Same response whether email or password is wrong (no account enumeration).
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonError(401, "Invalid email or password.");
    }
    await createSession(user.id);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return jsonError(500, "Login failed. Please try again.");
  }
}
