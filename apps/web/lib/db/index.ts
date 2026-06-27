import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

const connectionString = process.env.DATABASE_URL;

function createDb() {
  if (!connectionString) {
    return null;
  }
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export const db = createDb();

export function requireDb() {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not configured. Set it in .env.local to enable persistence."
    );
  }
  return db;
}

export { schema };
