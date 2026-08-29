import type { CheckResult, Window } from "../domain/types.ts";
import { inWindow, windowBounds } from "./windows.ts";

export interface UptimeReport {
  window: Window;
  /** Inclusive window bounds, epoch ms UTC. */
  from: number;
  to: number;
  /** Checks considered. */
  total: number;
  ok: number;
  failed: number;
  /**
   * Availability as a fraction in [0, 1], or null when no check landed in the
   * window.
   *
   * Null rather than 1. A monitor nobody has probed is not "100% available" —
   * it is unmeasured, and conflating the two is how a dashboard ends up
   * confidently reporting perfect uptime for an endpoint that has been down
   * since before the probe was deployed.
   */
  ratio: number | null;
  /** `ratio` as a percentage rounded to 3 decimal places, or null. */
  percent: number | null;
}

/** Round half away from zero, to `dp` decimal places. */
export function round(value: number, dp: number): number {
  const factor = 10 ** dp;
  const scaled = value * factor;
  // Nudge by one ulp-ish amount so that values which are mathematically
  // exact halves but stored slightly low in binary (0.145 -> 0.1449999…)
  // still round up. Without this, "round to 3dp" is subtly non-deterministic
  // across inputs that look identical in a test file.
  const nudged = scaled + (scaled >= 0 ? Number.EPSILON * Math.abs(scaled) : -Number.EPSILON * Math.abs(scaled));
  return Math.round(nudged) / factor;
}

/**
 * Rolling availability over `window`, ending at `now`.
 *
 * Results outside the window are ignored; results for other monitors are the
 * caller's problem to filter, because doing it here would hide the cost of
 * fetching too much.
 */
export function uptime(results: readonly CheckResult[], window: Window, now: number): UptimeReport {
  const { from, to } = windowBounds(window, now);

  let total = 0;
  let ok = 0;
  for (const result of results) {
    if (!inWindow(result.at, window, now)) continue;
    total += 1;
    if (result.ok) ok += 1;
  }

  const failed = total - ok;
  const ratio = total === 0 ? null : ok / total;

  return {
    window,
    from,
    to,
    total,
    ok,
    failed,
    ratio,
    percent: ratio === null ? null : round(ratio * 100, 3),
  };
}
