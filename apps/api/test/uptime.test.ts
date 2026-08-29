import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CheckResult } from "../src/domain/types.ts";
import { round, uptime } from "../src/lib/uptime.ts";
import { WINDOW_MS } from "../src/lib/windows.ts";

const NOW = Date.UTC(2026, 7, 29, 12, 0, 0); // 2026-08-29T12:00:00Z

function check(at: number, ok: boolean): CheckResult {
  return { monitorId: "m1", at, ok, responseMs: ok ? 100 : null, status: ok ? 200 : null };
}

describe("uptime", () => {
  it("is null, not 100%, when nothing has been measured", () => {
    const report = uptime([], "24h", NOW);
    assert.equal(report.total, 0);
    assert.equal(report.ratio, null);
    assert.equal(report.percent, null);
  });

  it("is null when every result falls outside the window", () => {
    const longAgo = NOW - WINDOW_MS["24h"] - 1;
    const report = uptime([check(longAgo, true)], "24h", NOW);
    assert.equal(report.total, 0);
    assert.equal(report.ratio, null);
  });

  it("counts a result landing exactly on the lower bound", () => {
    const from = NOW - WINDOW_MS["24h"];
    const report = uptime([check(from, true)], "24h", NOW);
    assert.equal(report.total, 1, "the lower bound is inclusive");
    assert.equal(report.ok, 1);
  });

  it("counts a result landing exactly on now", () => {
    const report = uptime([check(NOW, true)], "24h", NOW);
    assert.equal(report.total, 1, "the upper bound is inclusive");
  });

  it("excludes a result one millisecond before the window opens", () => {
    const justOutside = NOW - WINDOW_MS["24h"] - 1;
    const report = uptime([check(justOutside, true)], "24h", NOW);
    assert.equal(report.total, 0);
  });

  it("excludes a result one millisecond in the future", () => {
    const report = uptime([check(NOW + 1, true)], "24h", NOW);
    assert.equal(report.total, 0, "a probe cannot report from the future");
  });

  it("splits ok and failed", () => {
    const results = [
      check(NOW - 1_000, true),
      check(NOW - 2_000, false),
      check(NOW - 3_000, true),
      check(NOW - 4_000, true),
    ];
    const report = uptime(results, "24h", NOW);
    assert.equal(report.total, 4);
    assert.equal(report.ok, 3);
    assert.equal(report.failed, 1);
    assert.equal(report.ratio, 0.75);
    assert.equal(report.percent, 75);
  });

  it("reports 0 rather than null when everything failed", () => {
    const report = uptime([check(NOW - 1_000, false)], "24h", NOW);
    assert.equal(report.ratio, 0, "total outage is a measurement, not an absence of one");
    assert.equal(report.percent, 0);
  });

  it("reports the window bounds it actually used", () => {
    const report = uptime([], "7d", NOW);
    assert.equal(report.to, NOW);
    assert.equal(report.from, NOW - WINDOW_MS["7d"]);
  });

  it("rounds the percentage to three decimal places", () => {
    // 2 failures in 3 checks -> 33.3333…%
    const results = [check(NOW - 1, true), check(NOW - 2, false), check(NOW - 3, false)];
    const report = uptime(results, "24h", NOW);
    assert.equal(report.percent, 33.333);
  });

  it("does not round a near-perfect month up to 100%", () => {
    // One failure in 10_000 checks is 99.99%, which must not present as 100%.
    const results: CheckResult[] = [];
    for (let i = 0; i < 9_999; i += 1) results.push(check(NOW - i * 1_000, true));
    results.push(check(NOW - 9_999 * 1_000, false));

    const report = uptime(results, "30d", NOW);
    assert.equal(report.total, 10_000);
    assert.equal(report.percent, 99.99);
    assert.notEqual(report.percent, 100, "rounding must never manufacture a perfect month");
  });

  it("treats each window independently", () => {
    const results = [
      check(NOW - 1_000, false), // inside every window
      check(NOW - 3 * 24 * 60 * 60 * 1000, true), // 3 days ago: outside 24h
    ];
    assert.equal(uptime(results, "24h", NOW).total, 1);
    assert.equal(uptime(results, "7d", NOW).total, 2);
    assert.equal(uptime(results, "30d", NOW).total, 2);
  });
});

describe("round", () => {
  it("rounds halves away from zero", () => {
    assert.equal(round(0.5, 0), 1);
    assert.equal(round(1.5, 0), 2);
    assert.equal(round(2.5, 0), 3, "not banker's rounding");
  });

  it("rounds a value whose binary representation sits just below the half", () => {
    assert.equal(round(1.005, 2), 1.01);
    assert.equal(round(8.045, 2), 8.05);
  });

  it("leaves exact values alone", () => {
    assert.equal(round(99.99, 3), 99.99);
    assert.equal(round(100, 3), 100);
    assert.equal(round(0, 3), 0);
  });
});
