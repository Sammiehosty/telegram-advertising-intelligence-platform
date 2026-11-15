import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./auth";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Authentication required.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Authentication required.");
  if (user.role !== "admin") return jsonError(403, "Administrator access required.");
  return user;
}

export function isErrorResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

export function str(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export function intOr(v: unknown, fallback: number | null = null): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}
