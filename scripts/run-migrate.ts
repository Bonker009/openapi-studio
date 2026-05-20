import { runMigrations } from "../lib/db/migrate";

runMigrations();
console.log("Database migrations applied.");
