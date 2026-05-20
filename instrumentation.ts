/**
 * Prefer IPv4 when resolving "localhost" so internal fetches (e.g. RSC
 * prefetch, same-origin requests) hit 127.0.0.1 first. In Docker/Alpine,
 * ::1:3000 often refuses while 127.0.0.1:3000 works, which surfaces as
 * AggregateError / ECONNREFUSED during Server Components render.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");

    try {
      const { runMigrations } = await import("@/lib/db/migrate");
      runMigrations();
    } catch (error) {
      console.error("Database migration failed:", error);
    }
  }
}
