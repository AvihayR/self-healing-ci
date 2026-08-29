import type { CheckResult, Window } from "../domain/types.ts";
import { BUCKET_MS, bucketStart, inWindow, windowBounds } from "./windows.ts";

export interface Bucket {
  /** Inclusive start of the bucket, epoch ms UTC. */
  start: number;
  /** Exclusive end. */
  end: number;
  /** Checks that landed in this bucket. */
  total: number;
  ok: number;
  /**
   * Latency statistics over the checks in this bucket that actually returned a
   * response time. A bucket can have `total > 0` and `samples === 0` if every
   * probe in it failed to connect.
   */
  samples: number;
  p50: number | null;
  p95: number | null;
}

/**
 * Nearest-rank percentile over a sorted ascending array.
 *
 * Nearest-rank rather than interpolated: with a handful of samples per bucket,
 * interpolation invents response times that never happened, and "p95 = 412ms"
 * should mean some request actually took 412ms.
 */
export function percentile(sortedAscending: readonly number[], p: number): number | null {
  if (sortedAscending.length === 0) return null;
  if (!(p > 0 && p <= 100)) throw new RangeError(`p must be in (0, 100], got ${p}`);
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length, Math.max(1, rank)) - 1;
  return sortedAscending[index] ?? null;
}

/**
 * Bucket `results` into a contiguous series covering the window ending at `now`.
 *
 * The series is contiguous and gap-free by construction: a window with no data
 * still returns every bucket, each empty. A chart that silently omits quiet
 * periods reads as uptime, which is the opposite of the truth.
 */
export function bucketize(
  results: readonly CheckResult[],
  window: Window,
  now: number,
): Bucket[] {
  const bucketMs = BUCKET_MS[window];
  const { from } = windowBounds(window, now);

  const firstStart = bucketStart(from, bucketMs);
  const lastStart = bucketStart(now, bucketMs);
  const count = Math.floor((lastStart - firstStart) / bucketMs) + 1;

  const latencies: number[][] = Array.from({ length: count }, () => []);
  const buckets: Bucket[] = Array.from({ length: count }, (_unused, index) => {
    const start = firstStart + index * bucketMs;
    return { start, end: start + bucketMs, total: 0, ok: 0, samples: 0, p50: null, p95: null };
  });

  for (const result of results) {
    if (!inWindow(result.at, window, now)) continue;
    const index = Math.floor((bucketStart(result.at, bucketMs) - firstStart) / bucketMs);
    const bucket = buckets[index];
    const bucketLatencies = latencies[index];
    if (bucket === undefined || bucketLatencies === undefined) continue;

    bucket.total += 1;
    if (result.ok) bucket.ok += 1;
    if (result.responseMs !== null) bucketLatencies.push(result.responseMs);
  }

  for (const [index, bucket] of buckets.entries()) {
    const values = latencies[index] ?? [];
    values.sort((a, b) => a - b);
    bucket.samples = values.length;
    bucket.p50 = percentile(values, 50);
    bucket.p95 = percentile(values, 95);
  }

  return buckets;
}
