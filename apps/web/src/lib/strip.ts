import type { Bucket } from "../api-types.ts";

export type BucketState = "ok" | "degraded" | "down" | "empty";

/**
 * A bucket's state, from its own counts.
 *
 * `empty` is not a fourth severity — it means nothing was measured in that
 * period. It is drawn as an inert grey bar rather than as a zero-height one so
 * the chart never implies an outage it did not observe.
 */
export function bucketState(bucket: Bucket): BucketState {
  if (bucket.total === 0) return "empty";
  if (bucket.ok === 0) return "down";
  if (bucket.ok < bucket.total) return "degraded";
  return "ok";
}

/** The tallest p95 in the series, used to scale a latency plot. Null when nothing was measured. */
export function peakLatency(buckets: readonly Bucket[]): number | null {
  let peak: number | null = null;
  for (const bucket of buckets) {
    if (bucket.p95 === null) continue;
    if (peak === null || bucket.p95 > peak) peak = bucket.p95;
  }
  return peak;
}

/**
 * Bar height as a percentage, for the latency plot in the detail panel.
 *
 * Height is p95 wherever a p95 exists, including in a bucket that had some
 * failures — the latency of the checks that did answer is still real, and
 * flattening the whole series to full height whenever anything failed would
 * throw away the shape the plot exists to show. Only a bucket where *every*
 * check failed is drawn full height, because there is no latency to draw and an
 * outage should reach the top of the frame.
 *
 * The 6% floor keeps a very fast response visible as a mark rather than letting
 * it vanish into the axis.
 */
export function barHeight(bucket: Bucket, peak: number | null): number {
  const state = bucketState(bucket);
  if (state === "empty") return 0;
  if (state === "down") return 100;
  if (bucket.p95 === null || peak === null || peak <= 0) return 6;
  return Math.max(6, Math.round((bucket.p95 / peak) * 100));
}
