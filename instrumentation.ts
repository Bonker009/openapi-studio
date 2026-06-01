
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");

    try {
      const { runPostgresMigrations } = await import(
        "@/infrastructure/database"
      );
      await runPostgresMigrations();
    } catch (error) {
      console.error("Database migration failed:", error);
    }
  }
}
