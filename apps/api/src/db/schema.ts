import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Postgres owns monitors and configuration only. Check results are an
 * append-only time series and do not live here — see `store/types.ts`.
 *
 * Timestamps are stored as epoch milliseconds in a bigint rather than as
 * `timestamptz`. That is deliberate: the maths modules work in epoch ms, and a
 * round trip through a timestamp type is exactly where an accidental local-time
 * conversion would creep in.
 */
export const monitors = pgTable("monitors", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  intervalSeconds: integer("interval_seconds").notNull().default(300),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type MonitorRow = typeof monitors.$inferSelect;
export type NewMonitorRow = typeof monitors.$inferInsert;
