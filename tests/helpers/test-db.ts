import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

export const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../drizzle");

type BuiltQuery = { sql: string; params: unknown[] };
type BatchableQuery = { toSQL?: () => BuiltQuery; getQuery?: () => BuiltQuery };

/**
 * A real Postgres (PGlite, in-process WASM) with every migration applied.
 * Production uses neon-http, whose `db.batch` runs a statement list as one
 * transaction; PGlite's drizzle driver has no batch, so this adds one with
 * the same all-or-nothing semantics. PGlite serialises every query behind
 * its transaction lock, so other callers' queries can't interleave into it.
 */
export async function createTestDb(migrationsFolder = MIGRATIONS_FOLDER) {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });

  const batch = (queries: BatchableQuery[]) =>
    client.transaction(async (tx) => {
      const results = [];
      for (const query of queries) {
        const built = query.toSQL ? query.toSQL() : query.getQuery!();
        results.push(await tx.query(built.sql, built.params as unknown[]));
      }
      return results;
    });

  return { client, db: Object.assign(db, { batch }) };
}

let shared: ReturnType<typeof createTestDb> | null = null;

/** The database `@/db` resolves to in tests (one per test file). */
export function getTestDb() {
  shared ??= createTestDb();
  return shared;
}

/** Empties every application table between tests. */
export async function resetDb() {
  const { client } = await getTestDb();
  const { rows } = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'"
  );
  if (rows.length === 0) return;
  await client.exec(`truncate ${rows.map((r) => `"${r.tablename}"`).join(", ")} cascade`);
}
