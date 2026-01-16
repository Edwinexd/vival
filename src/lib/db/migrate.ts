import { config } from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || "postgres://localhost:5432/prog2review";

  console.log("Connecting to database...");

  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
  });

  try {
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    console.log("Running migrations...");

    await sql.unsafe(schema);

    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
