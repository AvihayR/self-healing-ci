import type { CheckResult, Monitor } from "../domain/types.ts";
import type { CheckStore, MonitorStore } from "./types.ts";

/**
 * In-memory implementations, used by tests and by `npm run dev` so the app runs
 * with nothing else installed. Postgres arrives with the Drizzle wiring and
 * OpenSearch at sitting 03; both slot in behind the same interfaces.
 */

export class InMemoryMonitorStore implements MonitorStore {
  readonly #monitors = new Map<string, Monitor>();

  async list(): Promise<Monitor[]> {
    return [...this.#monitors.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async get(id: string): Promise<Monitor | null> {
    return this.#monitors.get(id) ?? null;
  }

  async create(monitor: Monitor): Promise<Monitor> {
    this.#monitors.set(monitor.id, monitor);
    return monitor;
  }

  async remove(id: string): Promise<boolean> {
    return this.#monitors.delete(id);
  }
}

export class InMemoryCheckStore implements CheckStore {
  readonly #byMonitor = new Map<string, CheckResult[]>();

  async range(monitorId: string, from: number, to: number): Promise<CheckResult[]> {
    const all = this.#byMonitor.get(monitorId) ?? [];
    return all.filter((result) => result.at >= from && result.at <= to);
  }

  async latest(monitorId: string): Promise<CheckResult | null> {
    const all = this.#byMonitor.get(monitorId) ?? [];
    let newest: CheckResult | null = null;
    for (const result of all) {
      if (newest === null || result.at > newest.at) newest = result;
    }
    return newest;
  }

  async append(result: CheckResult): Promise<void> {
    const all = this.#byMonitor.get(result.monitorId) ?? [];
    all.push(result);
    this.#byMonitor.set(result.monitorId, all);
  }
}
