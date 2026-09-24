import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db";

type Query = BatchItem<"pg">;

/**
 * Runs the given statements in one database transaction. The neon-http
 * driver has no interactive transactions, but `db.batch` sends the whole
 * list as a single transaction — so every statement commits, or none does.
 * Statements can't depend on each other's results; pre-generate ids
 * (crypto.randomUUID) where one row must reference another.
 * Falsy entries are skipped so callers can include statements conditionally.
 */
export async function atomic(queries: (Query | null | undefined | false)[]): Promise<void> {
  const list = queries.filter((q): q is Query => Boolean(q));
  if (list.length === 0) return;
  await db.batch(list as [Query, ...Query[]]);
}
