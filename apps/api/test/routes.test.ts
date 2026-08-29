import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { buildApp } from "../src/app.ts";
import { InMemoryCheckStore, InMemoryMonitorStore } from "../src/store/memory.ts";

const NOW = Date.UTC(2026, 7, 29, 12, 0, 0);

/**
 * Fastify's inject response types `json()` as `any`. Naming the shape at each
 * call site is not ceremony: it means a change to the API contract fails these
 * tests at compile time rather than surviving until an assertion happens to
 * touch the field that moved.
 */
interface MonitorBody {
  id: string;
  url: string;
  name: string;
  intervalSeconds: number;
  createdAt: number;
}

interface StatusBody extends MonitorBody {
  lastCheckedAt: number | null;
  up: boolean | null;
  lastResponseMs: number | null;
}

interface UptimeBody {
  window: string;
  total: number;
  ok: number;
  failed: number;
  ratio: number | null;
  percent: number | null;
}

interface HistoryBody {
  monitorId: string;
  window: string;
  buckets: { start: number; total: number }[];
}

interface ErrorBody {
  error: string;
}

function json<T>(response: { json: () => unknown }): T {
  return response.json() as T;
}


function harness() {
  const monitors = new InMemoryMonitorStore();
  const checks = new InMemoryCheckStore();
  const app = buildApp({ monitors, checks, now: () => NOW, startedAt: NOW - 5_000 });
  return { app, monitors, checks };
}

const created: Awaited<ReturnType<typeof harness>>["app"][] = [];
function appFor() {
  const h = harness();
  created.push(h.app);
  return h;
}

after(async () => {
  await Promise.all(created.map((app) => app.close()));
});

describe("GET /healthz", () => {
  it("reports ok and an uptime", async () => {
    const { app } = appFor();
    const response = await app.inject({ method: "GET", url: "/healthz" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(json(response), { status: "ok", uptimeSeconds: 5 });
  });
});

describe("POST /monitors", () => {
  it("creates a monitor and defaults the interval", async () => {
    const { app } = appFor();
    const response = await app.inject({
      method: "POST",
      url: "/monitors",
      payload: { url: "https://example.com", name: "example" },
    });

    assert.equal(response.statusCode, 201);
    const body = json<MonitorBody>(response);
    assert.equal(body.url, "https://example.com");
    assert.equal(body.intervalSeconds, 300);
    assert.equal(body.createdAt, NOW);
    assert.ok(typeof body.id === "string" && body.id.length > 0);
  });

  it("rejects a body that is not a URL", async () => {
    const { app } = appFor();
    const response = await app.inject({
      method: "POST",
      url: "/monitors",
      payload: { url: "not-a-url", name: "bad" },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(json<ErrorBody>(response).error, "invalid_body");
  });

  it("rejects an interval below the floor", async () => {
    const { app } = appFor();
    const response = await app.inject({
      method: "POST",
      url: "/monitors",
      payload: { url: "https://example.com", name: "fast", intervalSeconds: 5 },
    });
    assert.equal(response.statusCode, 400);
  });
});

describe("GET /monitors", () => {
  it("returns an empty list before anything is registered", async () => {
    const { app } = appFor();
    const response = await app.inject({ method: "GET", url: "/monitors" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(json(response), []);
  });

  it("reports a null status for a monitor that has never been probed", async () => {
    const { app } = appFor();
    await app.inject({
      method: "POST",
      url: "/monitors",
      payload: { url: "https://example.com", name: "example" },
    });

    const [monitor] = json<StatusBody[]>(await app.inject({ method: "GET", url: "/monitors" }));
    assert.ok(monitor !== undefined, "expected one monitor in the list");
    assert.equal(monitor.up, null, "unmeasured is not up");
    assert.equal(monitor.lastCheckedAt, null);
  });

  it("surfaces the most recent check", async () => {
    const { app, monitors, checks } = appFor();
    await monitors.create({ id: "m1", url: "https://a.test", name: "a", intervalSeconds: 300, createdAt: NOW });
    await checks.append({ monitorId: "m1", at: NOW - 10_000, ok: false, responseMs: null, status: null });
    await checks.append({ monitorId: "m1", at: NOW - 1_000, ok: true, responseMs: 42, status: 200 });

    const [monitor] = json<StatusBody[]>(await app.inject({ method: "GET", url: "/monitors" }));
    assert.ok(monitor !== undefined, "expected one monitor in the list");
    assert.equal(monitor.up, true);
    assert.equal(monitor.lastResponseMs, 42);
    assert.equal(monitor.lastCheckedAt, NOW - 1_000);
  });
});

describe("GET /monitors/:id/uptime", () => {
  it("404s for an unknown monitor", async () => {
    const { app } = appFor();
    const response = await app.inject({ method: "GET", url: "/monitors/nope/uptime" });
    assert.equal(response.statusCode, 404);
  });

  it("rejects an unknown window", async () => {
    const { app, monitors } = appFor();
    await monitors.create({ id: "m1", url: "https://a.test", name: "a", intervalSeconds: 300, createdAt: NOW });
    const response = await app.inject({ method: "GET", url: "/monitors/m1/uptime?window=1y" });
    assert.equal(response.statusCode, 400);
    assert.equal(json<ErrorBody>(response).error, "invalid_window");
  });

  it("returns a null ratio for a monitor with no checks", async () => {
    const { app, monitors } = appFor();
    await monitors.create({ id: "m1", url: "https://a.test", name: "a", intervalSeconds: 300, createdAt: NOW });
    const body = json<UptimeBody>(await app.inject({ method: "GET", url: "/monitors/m1/uptime" }));
    assert.equal(body.ratio, null);
    assert.equal(body.window, "30d", "30d is the default window");
  });

  it("computes availability over the requested window", async () => {
    const { app, monitors, checks } = appFor();
    await monitors.create({ id: "m1", url: "https://a.test", name: "a", intervalSeconds: 300, createdAt: NOW });
    await checks.append({ monitorId: "m1", at: NOW - 1_000, ok: true, responseMs: 10, status: 200 });
    await checks.append({ monitorId: "m1", at: NOW - 2_000, ok: true, responseMs: 10, status: 200 });
    await checks.append({ monitorId: "m1", at: NOW - 3_000, ok: false, responseMs: null, status: null });

    const body = json<UptimeBody>(await app.inject({ method: "GET", url: "/monitors/m1/uptime?window=24h" }));
    assert.equal(body.total, 3);
    assert.equal(body.ok, 2);
    assert.equal(body.percent, 66.667);
  });
});

describe("GET /monitors/:id/history", () => {
  it("returns a contiguous bucket series", async () => {
    const { app, monitors } = appFor();
    await monitors.create({ id: "m1", url: "https://a.test", name: "a", intervalSeconds: 300, createdAt: NOW });
    const body = json<HistoryBody>(await app.inject({ method: "GET", url: "/monitors/m1/history?window=24h" }));

    assert.equal(body.window, "24h");
    assert.equal(body.buckets.length, 25, "24 hourly buckets plus the partial one containing now");
    assert.equal(body.buckets[0]?.total, 0);
  });
});

describe("DELETE /monitors/:id", () => {
  it("removes a monitor and then 404s", async () => {
    const { app, monitors } = appFor();
    await monitors.create({ id: "m1", url: "https://a.test", name: "a", intervalSeconds: 300, createdAt: NOW });

    assert.equal((await app.inject({ method: "DELETE", url: "/monitors/m1" })).statusCode, 204);
    assert.equal((await app.inject({ method: "DELETE", url: "/monitors/m1" })).statusCode, 404);
  });
});
