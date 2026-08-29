import type { CheckResult, Monitor } from "../domain/types.ts";
import type { CheckStore, MonitorStore } from "../store/types.ts";

/**
 * Development seed data, so the dashboard has something to read before the
 * probe Lambda exists.
 *
 * Deterministic on purpose. An unseeded `Math.random()` here would be the exact
 * flaky-test generator this project injects deliberately at break 04, and it
 * would also mean no two screenshots of the app ever matched. Same seed, same
 * history, every run.
 */

/** mulberry32 — small, fast, and good enough for shaping demo data. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  name: string;
  url: string;
  /** Baseline response time in ms. */
  baseMs: number;
  /** Spread around the baseline. */
  jitterMs: number;
  /** Probability any single check fails, outside an incident. */
  failureRate: number;
  /** Outage windows as [hoursAgoStart, hoursAgoEnd]. */
  incidents: [number, number][];
  /** Fraction of the 30 days this monitor has existed for. 1 = the whole window. */
  coverage?: number;
  /** When true, no checks are generated at all — an unmeasured monitor. */
  unmeasured?: boolean;
}

const PROFILES: Profile[] = [
  {
    name: "marketing site",
    url: "https://canary.example.com",
    baseMs: 84,
    jitterMs: 30,
    failureRate: 0.0004,
    incidents: [],
  },
  {
    name: "checkout api",
    url: "https://api.example.com/checkout",
    baseMs: 210,
    jitterMs: 90,
    failureRate: 0.002,
    incidents: [
      [51, 47],
      [9, 8],
    ],
  },
  {
    name: "auth service",
    url: "https://auth.example.com/healthz",
    baseMs: 143,
    jitterMs: 40,
    failureRate: 0.001,
    incidents: [[288, 279]],
  },
  {
    name: "image cdn",
    url: "https://cdn.example.com/status",
    baseMs: 38,
    jitterMs: 14,
    failureRate: 0.0002,
    incidents: [],
  },
  {
    name: "reporting worker",
    url: "https://jobs.example.com/reporting",
    baseMs: 640,
    jitterMs: 380,
    failureRate: 0.02,
    incidents: [[3, 0]],
  },
  {
    name: "legacy billing",
    url: "https://billing.internal.example.com",
    baseMs: 0,
    jitterMs: 0,
    failureRate: 0,
    incidents: [],
    unmeasured: true,
  },
  {
    name: "status page",
    url: "https://status.example.com",
    baseMs: 62,
    jitterMs: 22,
    failureRate: 0.0006,
    incidents: [],
    coverage: 0.18,
  },
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const INTERVAL_MS = 5 * MINUTE;
const SPAN_MS = 30 * DAY;

function inIncident(hoursAgo: number, incidents: [number, number][]): boolean {
  return incidents.some(([start, end]) => hoursAgo <= start && hoursAgo >= end);
}

/**
 * Populate the stores with seven monitors and thirty days of five-minute checks.
 *
 * The set is chosen to exercise every state the interface has to render, not to
 * look tidy: a monitor that is down right now, one recovering from an outage
 * inside the 24h window, one that has never been probed at all, and one
 * registered too recently to fill its own 30-day window.
 */
export async function seed(
  monitors: MonitorStore,
  checks: CheckStore,
  now: number,
  seedValue = 20260829,
): Promise<void> {
  const random = prng(seedValue);

  for (const [index, profile] of PROFILES.entries()) {
    const coverage = profile.coverage ?? 1;
    const createdAt = now - Math.round(SPAN_MS * coverage);

    const monitor: Monitor = {
      id: `seed-${index + 1}`,
      url: profile.url,
      name: profile.name,
      intervalSeconds: INTERVAL_MS / 1000,
      createdAt,
    };
    await monitors.create(monitor);

    if (profile.unmeasured) continue;

    for (let at = createdAt; at <= now; at += INTERVAL_MS) {
      const hoursAgo = (now - at) / HOUR;
      const down = inIncident(hoursAgo, profile.incidents) || random() < profile.failureRate;

      let result: CheckResult;
      if (down) {
        result = { monitorId: monitor.id, at, ok: false, responseMs: null, status: null };
      } else {
        // A slow diurnal swell plus per-check jitter, so the strip chart has
        // shape rather than a flat band.
        const swell = Math.sin((at / HOUR) * 0.26) * profile.jitterMs * 0.55;
        const jitter = (random() - 0.5) * profile.jitterMs;
        const responseMs = Math.max(4, Math.round(profile.baseMs + swell + jitter));
        result = { monitorId: monitor.id, at, ok: true, responseMs, status: 200 };
      }
      await checks.append(result);
    }
  }
}
