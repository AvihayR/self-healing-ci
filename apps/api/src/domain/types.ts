/**
 * Core domain types.
 *
 * All instants are epoch milliseconds, UTC. There is no `Date` in the maths
 * modules on purpose: every timezone bug this project deliberately injects
 * later has to come from a place we chose, not from an implicit local-time
 * conversion nobody noticed.
 */

/** A window over which availability and latency are reported. */
export type Window = "24h" | "7d" | "30d";

export const WINDOWS: readonly Window[] = ["24h", "7d", "30d"] as const;

export function isWindow(value: unknown): value is Window {
  return typeof value === "string" && (WINDOWS as readonly string[]).includes(value);
}

/** One probe of one monitor. */
export interface CheckResult {
  monitorId: string;
  /** Epoch ms, UTC. When the probe started. */
  at: number;
  /** Did the endpoint answer acceptably? */
  ok: boolean;
  /**
   * Round-trip time in ms, or null when there was no response at all
   * (DNS failure, connection refused, timeout). Null is not zero: a failed
   * connection has no latency, and averaging it as zero would quietly drag
   * every percentile down.
   */
  responseMs: number | null;
  /** HTTP status, or null when no response was received. */
  status: number | null;
}

export interface Monitor {
  id: string;
  url: string;
  name: string;
  /** How often the probe should run, in seconds. */
  intervalSeconds: number;
  createdAt: number;
}
