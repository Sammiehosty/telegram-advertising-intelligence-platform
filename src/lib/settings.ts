import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type ScoringWeights = {
  relevance: number;
  views: number;
  engagement: number;
  consistency: number;
  recency: number;
  audience: number;
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
  relevance: 30,
  views: 20,
  engagement: 20,
  consistency: 15,
  recency: 10,
  audience: 5,
};

export type ProviderFlags = {
  mtproto: boolean;
  directory: boolean;
  demo: boolean;
};

export const DEFAULT_PROVIDERS: ProviderFlags = {
  mtproto: true,
  directory: true,
  demo: true,
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    if (!rows[0]) return fallback;
    return { ...(fallback as object), ...(rows[0].value as object) } as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}
