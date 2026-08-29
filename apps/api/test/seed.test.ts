import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seed } from "../src/dev/seed.ts";
import { uptime } from "../src/lib/uptime.ts";
import { InMemoryCheckStore, InMemoryMonitorStore } from "../src/store/memory.ts";

const NOW = Date.UTC(2026, 7, 29, 12, 0, 0);

async function seeded() {
  const monitors = new InMemoryMonitorStore();
  const checks = new InMemoryCheckStore();
  await seed(monitors, checks, NOW);
  return { monitors, checks };
}

describe("seed", () => {
  it("is deterministic for a given seed value", async () => {
    const a = await seeded();
    const b = await seeded();

    const listA = await a.monitors.list();
    const listB = await b.monitors.list();
    assert.deepEqual(listA, listB);

    const checksA = await a.checks.range("seed-2", 0, NOW);
    const checksB = await b.checks.range("seed-2", 0, NOW);
    assert.deepEqual(checksA, checksB, "same seed must produce identical history");
  });

  it("produces different history for a different seed value", async () => {
    const monitors = new InMemoryMonitorStore();
    const checks = new InMemoryCheckStore();
    await seed(monitors, checks, NOW, 1);

    const base = (await seeded()).checks;
    const other = await checks.range("seed-5", 0, NOW);
    const original = await base.range("seed-5", 0, NOW);
    assert.notDeepEqual(other, original);
  });

  it("includes a monitor that has never been probed", async () => {
    const { monitors, checks } = await seeded();
    const all = await monitors.list();
    const unmeasured = all.find((monitor) => monitor.name === "legacy billing");
    assert.ok(unmeasured !== undefined);
    assert.equal(await checks.latest(unmeasured.id), null, "the unmeasured state needs a subject");
  });

  it("includes a monitor that is down right now", async () => {
    const { monitors, checks } = await seeded();
    const all = await monitors.list();
    const failing = all.find((monitor) => monitor.name === "reporting worker");
    assert.ok(failing !== undefined);
    const latest = await checks.latest(failing.id);
    assert.equal(latest?.ok, false);
  });

  it("gives a healthy monitor an availability above 99%", async () => {
    const { checks } = await seeded();
    const results = await checks.range("seed-1", 0, NOW);
    const report = uptime(results, "30d", NOW);
    assert.ok(report.percent !== null && report.percent > 99, `expected >99%, got ${report.percent}`);
  });

  it("gives the incident-prone monitor an availability below 100%", async () => {
    const { checks } = await seeded();
    const results = await checks.range("seed-2", 0, NOW);
    const report = uptime(results, "30d", NOW);
    assert.ok(report.percent !== null && report.percent < 100);
    assert.ok(report.failed > 0);
  });

  it("leaves a recently registered monitor without a full window of history", async () => {
    const { monitors, checks } = await seeded();
    const all = await monitors.list();
    const recent = all.find((monitor) => monitor.name === "status page");
    assert.ok(recent !== undefined);

    const results = await checks.range(recent.id, 0, NOW);
    const earliest = Math.min(...results.map((result) => result.at));
    assert.ok(earliest > NOW - 30 * 24 * 60 * 60 * 1000 + 1, "partial coverage needs a subject too");
  });

  it("never emits a response time for a failed check", async () => {
    const { checks } = await seeded();
    for (const id of ["seed-2", "seed-3", "seed-5"]) {
      const results = await checks.range(id, 0, NOW);
      for (const result of results) {
        if (!result.ok) {
          assert.equal(result.responseMs, null, "a failed connection has no latency");
          assert.equal(result.status, null);
        }
      }
    }
  });
});
