import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiConfigurations, systemLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, isErrorResponse, jsonError, str } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";

/** GET — masked Telegram API configuration state. Never returns secrets. */
export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  const rows = await db.select().from(apiConfigurations).limit(1);
  const cfg = rows[0];
  return NextResponse.json({
    ok: true,
    config: {
      configured: !!cfg?.apiId && !!cfg?.apiHashCipher,
      status: cfg?.status ?? "not_configured",
      apiId: cfg?.apiId ?? "",
      apiHashSet: !!cfg?.apiHashCipher,
      sessionSet: !!cfg?.sessionCipher,
      notes: cfg?.notes ?? "",
      updatedAt: cfg?.updatedAt ?? null,
      instructions:
        "Create an application at https://my.telegram.org/apps to obtain API ID and API Hash, then generate a session with the bundled Telethon worker (workers/telethon_worker.py).",
    },
  });
}

/** PUT — store Telegram credentials encrypted (AES-256-GCM at rest). */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  const body = await req.json().catch(() => ({}));
  const apiId = str(body.apiId, 32);
  const apiHash = str(body.apiHash, 128);
  const sessionString = str(body.sessionString, 2000);

  if (body.clear === true) {
    await db.delete(apiConfigurations).where(eq(apiConfigurations.id, "telegram"));
    await db.insert(apiConfigurations).values({ id: "telegram", status: "not_configured", updatedAt: new Date() });
    await db.insert(systemLogs).values({ level: "warn", source: "admin", message: "Telegram API configuration cleared." });
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!/^\d{5,10}$/.test(apiId)) return jsonError(400, "API ID must be the numeric id from my.telegram.org (5–10 digits).");
  if (apiHash && apiHash.length < 20) return jsonError(400, "API Hash looks too short.");

  const existing = await db.select().from(apiConfigurations).limit(1);
  const cfg = existing[0];
  const values = {
    id: "telegram",
    apiId,
    apiHashCipher: apiHash ? encryptSecret(apiHash) : cfg?.apiHashCipher ?? null,
    sessionCipher: sessionString ? encryptSecret(sessionString) : cfg?.sessionCipher ?? null,
    status: "configured",
    notes: str(body.notes, 500),
    updatedAt: new Date(),
  };
  if (cfg) {
    await db.update(apiConfigurations).set(values).where(eq(apiConfigurations.id, "telegram"));
  } else {
    await db.insert(apiConfigurations).values(values);
  }
  await db.insert(systemLogs).values({ level: "info", source: "admin", message: "Telegram API credentials updated (stored encrypted)." });
  return NextResponse.json({ ok: true, status: "configured" });
}
