import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CheckResult } from "../src/domain/types.ts";
import { bucketize, percentile } from "../src/lib/buckets.ts";
import { BUCKET_MS, bucketStart, WINDOW_MS } from "../src/lib/windows.ts";

const HOUR = 60 * 60 * 1000;
/** Deliberately not on an hour boundary — the grid must not depend on `now` being tidy. */
const NOW = Date.UTC(2026, 7, 29, 12, 37, 41, 123);

function check(at: number, ok: boolean, responseMs: number | null): CheckResult {
  return { monitorId: "m1", at, ok, responseMs, status: ok ? 200 : null };
}

describe("bucketStart", () => {
  it("aligns to the epoch, not to the value passed in", () => {
    const at = Date.UTC(2026, 7, 29, 12, 37, 41, 123);
    assert.equal(bucketStart(at, HOUR), Date.UTC(2026, 7, 29, 12, 0, 0, 0));
  });

  it("is stable across two instants in the same bucket", () => {
    const a = Date.UTC(2026, 7, 29, 12, 0, 0, 1);
    const b = Date.UTC(2026, 7, 29, 12, 59, 59, 999);
    assert.equal(bucketStart(a, HOUR), bucketStart(b, HOUR));
  });

  it("puts an instant exactly on a boundary into the bucket it opens", () => {
    const boundary = Date.UTC(2026, 7, 29, 13, 0, 0, 0);
    assert.equal(bucketStart(boundary, HOUR), boundary);
  });

  it("rejects a non-positive bucket width", () => {
    assert.throws(() => bucketStart(NOW, 0), RangeError);
    assert.throws(() => bucketStart(NOW, -HOUR), RangeError);
  });
});

describe("percentile", () => {
  it("is null for no samples", () => {
    assert.equal(percentile([], 50), null);
  });

  it("returns a value that is actually in the input", () => {
    const values = [10, 20, 30, 40];
    const p95 = percentile(values, 95);
    assert.ok(p95 !== null && values.includes(p95), "nearest-rank must not interpolate");
  });

  it("uses nearest rank", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(percentile(values, 50), 5);
    assert.equal(percentile(values, 95), 10);
    assert.equal(percentile(values, 100), 10);
  });

  it("handles a single sample", () => {
    assert.equal(percentile([42], 50), 42);
    assert.equal(percentile([42], 95), 42);
  });

  it("rejects a percentile outside (0, 100]", () => {
    assert.throws(() => percentile([1], 0), RangeError);
    assert.throws(() => percentile([1], 101), RangeError);
  });
});

describe("bucketize", () => {
  it("returns a gap-free series even with no data", () => {
    const buckets = bucketize([], "24h", NOW);
    assert.ok(buckets.length > 0);
    for (const [index, bucket] of buckets.entries()) {
      assert.equal(bucket.total, 0);
      assert.equal(bucket.p50, null);
      if (index > 0) {
        const previous = buckets[index - 1];
        assert.ok(previous !== undefined);
        assert.equal(bucket.start, previous.end, "buckets must be contiguous");
      }
    }
  });

  it("covers the whole window for each size", () => {
    for (const window of ["24h", "7d", "30d"] as const) {
      const buckets = bucketize([], window, NOW);
      const first = buckets[0];
      const last = buckets[buckets.length - 1];
      assert.ok(first !== undefined && last !== undefined);
      assert.ok(first.start <= NOW - WINDOW_MS[window], `${window}: first bucket must cover the window start`);
      assert.ok(last.end > NOW, `${window}: last bucket must contain now`);
      assert.equal((last.start - first.start) / BUCKET_MS[window] + 1, buckets.length);
    }
  });

  it("places a result in the bucket its instant falls in", () => {
    const at = Date.UTC(2026, 7, 29, 10, 15, 0);
    const buckets = bucketize([check(at, true, 120)], "24h", NOW);
    const hit = buckets.filter((bucket) => bucket.total > 0);
    assert.equal(hit.length, 1);
    assert.equal(hit[0]?.start, Date.UTC(2026, 7, 29, 10, 0, 0));
  });

  it("ignores results outside the window", () => {
    const tooOld = NOW - WINDOW_MS["24h"] - 1;
    const buckets = bucketize([check(tooOld, true, 120)], "24h", NOW);
    assert.equal(buckets.reduce((sum, bucket) => sum + bucket.total, 0), 0);
  });

  it("counts a failed probe in total but not in the latency samples", () => {
    const at = NOW - HOUR;
    const buckets = bucketize([check(at, false, null), check(at, true, 200)], "24h", NOW);
    const hit = buckets.find((bucket) => bucket.total > 0);
    assert.ok(hit !== undefined);
    assert.equal(hit.total, 2);
    assert.equal(hit.ok, 1);
    assert.equal(hit.samples, 1, "a connection failure has no latency to sample");
    assert.equal(hit.p50, 200);
  });

  it("leaves percentiles null in a bucket where every probe failed to connect", () => {
    const at = NOW - HOUR;
    const buckets = bucketize([check(at, false, null)], "24h", NOW);
    const hit = buckets.find((bucket) => bucket.total > 0);
    assert.ok(hit !== undefined);
    assert.equal(hit.total, 1);
    assert.equal(hit.samples, 0);
    assert.equal(hit.p50, null, "no samples must not become zero");
    assert.equal(hit.p95, null);
  });

  it("does not mutate or reorder the caller's array", () => {
    const at = NOW - HOUR;
    const input = [check(at, true, 300), check(at, true, 100), check(at, true, 200)];
    const snapshot = input.map((result) => result.responseMs);
    bucketize(input, "24h", NOW);
    assert.deepEqual(input.map((result) => result.responseMs), snapshot);
  });

  it("computes percentiles per bucket, not across the window", () => {
    const early = NOW - 3 * HOUR;
    const late = NOW - 1 * HOUR;
    const buckets = bucketize(
      [check(early, true, 10), check(early, true, 20), check(late, true, 1_000)],
      "24h",
      NOW,
    );
    const populated = buckets.filter((bucket) => bucket.total > 0);
    assert.equal(populated.length, 2);
    assert.equal(populated[0]?.p50, 10);
    assert.equal(populated[1]?.p50, 1_000);
  });

  it("puts a result exactly on the window's lower bound into the series", () => {
    const from = NOW - WINDOW_MS["24h"];
    const buckets = bucketize([check(from, true, 50)], "24h", NOW);
    assert.equal(buckets.reduce((sum, bucket) => sum + bucket.total, 0), 1);
  });
});
