/**
 * Seed script — creates the initial administrator account.
 * Run: npx tsx scripts/seed.ts
 * Override with env: SEED_ADMIN_NAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users, settings } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { DEFAULT_WEIGHTS, DEFAULT_PROVIDERS } from "../src/lib/settings";

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@telead.app").toLowerCase();
  const name = process.env.SEED_ADMIN_NAME || "Administrator";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set SEED_ADMIN_PASSWORD to a unique password of at least 12 characters before seeding.");
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    console.log(`Admin already exists (${email}) — skipping user creation.`);
  } else {
    await db.insert(users).values({ name, email, passwordHash: hashPassword(password), role: "admin" });
    console.log(`Created admin user: ${email}`);
    console.log("Sign in with the password supplied through SEED_ADMIN_PASSWORD.");
  }

  // Default global settings
  for (const [key, value] of Object.entries({ weights: DEFAULT_WEIGHTS, providers: DEFAULT_PROVIDERS, defaults: { periodDays: 30 } })) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }
  console.log("Default settings ensured (weights, providers, defaults).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
