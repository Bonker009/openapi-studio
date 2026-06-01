import { runPostgresMigrations } from "../src/infrastructure/database/postgres-migrate";

async function main() {
  await runPostgresMigrations();
  console.log("PostgreSQL migrations applied.");
}

main().catch((error) => {
  console.error("Failed to run PostgreSQL migrations:", error);
  process.exit(1);
});
