import { cookies } from "next/headers";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Read the PHP backend's httpOnly session cookie during a Server Component
 * render and validate it against the PHP /auth/me endpoint.
 *
 * The browser-facing API is proxied by next.config.ts. Server Components
 * cannot rely on that browser proxy cookie context, so this server-side
 * validation forwards only the telead_session cookie to the PHP API.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("telead_session")?.value;
    if (!sessionToken) return null;

    const apiBase = (
      process.env.TELEAD_PHP_API_URL ||
      "https://teleads.sammiehosty.com/api"
    ).replace(/\/$/, "");

    const response = await fetch(`${apiBase}/auth/me`, {
      method: "GET",
      headers: {
        Cookie: `telead_session=${encodeURIComponent(sessionToken)}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      ok?: boolean;
      user?: SessionUser | null;
    };

    if (!payload.ok || !payload.user?.id || !payload.user.email) return null;
    return {
      id: String(payload.user.id),
      name: String(payload.user.name || ""),
      email: String(payload.user.email),
      role: String(payload.user.role || "user"),
    };
  } catch {
    // Treat backend/network failures as an unauthenticated session. The
    // PHP API remains the source of truth for authorization.
    return null;
  }
}
