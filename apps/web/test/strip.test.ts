import { describe, expect, it } from "vitest";

import type { Bucket } from "../src/api-types.ts";
import { barHeight, bucketState, peakLatency } from "../src/lib/strip.ts";

function bucket(partial: Partial<Bucket>): Bucket {
  return { start: 0, end: 3_600_000, total: 0, ok: 0, samples: 0, p50: null, p95: null, ...partial };
}

describe("bucketState", () => {
  it("calls a bucket with no checks empty, not down", () => {
    expect(bucketState(bucket({}))).toBe("empty");
  });

  it("calls a fully successful bucket ok", () => {
    expect(bucketState(bucket({ total: 12, ok: 12 }))).toBe("ok");
  });

  it("calls a fully failed bucket down", () => {
    expect(bucketState(bucket({ total: 12, ok: 0 }))).toBe("down");
  });

  it("calls a partially failed bucket degraded", () => {
    expect(bucketState(bucket({ total: 12, ok: 11 }))).toBe("degraded");
  });

  it("treats a single failure in a busy bucket as degraded, not down", () => {
    expect(bucketState(bucket({ total: 240, ok: 239 }))).toBe("degraded");
  });
});

describe("peakLatency", () => {
  it("is null when nothing was measured", () => {
    expect(peakLatency([])).toBeNull();
    expect(peakLatency([bucket({ total: 3, ok: 0 })])).toBeNull();
  });

  it("ignores buckets with no p95", () => {
    const series = [bucket({ total: 3, ok: 0 }), bucket({ total: 3, ok: 3, p95: 210 })];
    expect(peakLatency(series)).toBe(210);
  });

  it("finds the maximum", () => {
    const series = [
      bucket({ total: 1, ok: 1, p95: 90 }),
      bucket({ total: 1, ok: 1, p95: 640 }),
      bucket({ total: 1, ok: 1, p95: 120 }),
    ];
    expect(peakLatency(series)).toBe(640);
  });
});

describe("barHeight", () => {
  it("gives an empty bucket no height at all", () => {
    expect(barHeight(bucket({}), 500)).toBe(0);
  });

  it("gives a total outage full height", () => {
    expect(barHeight(bucket({ total: 12, ok: 0 }), 500)).toBe(100);
  });

  it("scales a healthy bucket against the peak", () => {
    expect(barHeight(bucket({ total: 12, ok: 12, p95: 250 }), 500)).toBe(50);
    expect(barHeight(bucket({ total: 12, ok: 12, p95: 500 }), 500)).toBe(100);
  });

  it("keeps a degraded bucket at its real latency rather than flattening it", () => {
    const degraded = bucket({ total: 12, ok: 11, p95: 100 });
    expect(barHeight(degraded, 500)).toBe(20);
    expect(barHeight(degraded, 500)).not.toBe(100);
  });

  it("floors a very fast response so it stays visible", () => {
    expect(barHeight(bucket({ total: 12, ok: 12, p95: 1 }), 5_000)).toBe(6);
  });

  it("does not divide by a zero or missing peak", () => {
    expect(barHeight(bucket({ total: 12, ok: 12, p95: 100 }), 0)).toBe(6);
    expect(barHeight(bucket({ total: 12, ok: 12, p95: 100 }), null)).toBe(6);
  });
});
