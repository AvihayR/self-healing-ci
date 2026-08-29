import type { Window } from "../domain/types.ts";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Total span of each reporting window. */
export const WINDOW_MS: Readonly<Record<Window, number>> = {
  "24h": 24 * HOUR,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
};

/**
 * Bucket width per window. Chosen so every window yields a similar number of
 * buckets (24, 28, 30) — a chart with a stable point count is far easier to
 * eyeball for wrongness than one that changes shape with the window.
 */
export const BUCKET_MS: Readonly<Record<Window, number>> = {
  "24h": 1 * HOUR,
  "7d": 6 * HOUR,
  "30d": 1 * DAY,
};

/**
 * Start of the bucket containing `at`, aligned to the UTC epoch.
 *
 * Alignment is to epoch zero rather than to `now`, so the same instant always
 * lands in the same bucket no matter when the query runs. Two requests a minute
 * apart therefore agree about history instead of each inventing their own grid.
 */
export function bucketStart(at: number, bucketMs: number): number {
  if (!Number.isFinite(at)) throw new RangeError(`at must be finite, got ${at}`);
  if (!Number.isInteger(bucketMs) || bucketMs <= 0) {
    throw new RangeError(`bucketMs must be a positive integer, got ${bucketMs}`);
  }
  return Math.floor(at / bucketMs) * bucketMs;
}

/**
 * Inclusive bounds of a window ending at `now`.
 *
 * Both ends are inclusive. A result landing exactly on `from` is inside the
 * window; so is one landing exactly on `to`. Stated here once so that every
 * caller agrees, because half-open versus closed intervals is precisely the
 * kind of disagreement that produces an off-by-one nobody can find.
 */
export function windowBounds(window: Window, now: number): { from: number; to: number } {
  return { from: now - WINDOW_MS[window], to: now };
}

/** Is `at` inside the window ending at `now`? Both bounds inclusive. */
export function inWindow(at: number, window: Window, now: number): boolean {
  const { from, to } = windowBounds(window, now);
  return at >= from && at <= to;
}
