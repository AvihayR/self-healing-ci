import type { CheckResult, Monitor } from "../domain/types.ts";

/**
 * Two stores, because the system has two very different shapes of data.
 *
 * Monitors are mutable configuration and belong in Postgres, which owns them.
 * Check results are an append-only time series and will live in OpenSearch from
 * sitting 03 onwards. Keeping the boundary explicit from day one is what lets
 * that swap be a new implementation of an existing interface rather than a
 * rewrite of every route.
 */

export interface MonitorStore {
  list(): Promise<Monitor[]>;
  get(id: string): Promise<Monitor | null>;
  create(monitor: Monitor): Promise<Monitor>;
  remove(id: string): Promise<boolean>;
}

export interface CheckStore {
  /** Results for one monitor within [from, to], both inclusive. */
  range(monitorId: string, from: number, to: number): Promise<CheckResult[]>;
  /** The most recent result for one monitor, or null. */
  latest(monitorId: string): Promise<CheckResult | null>;
  append(result: CheckResult): Promise<void>;
}
