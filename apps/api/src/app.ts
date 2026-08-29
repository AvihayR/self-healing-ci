import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import type { Monitor } from "./domain/types.ts";
import { isWindow } from "./domain/types.ts";
import { bucketize } from "./lib/buckets.ts";
import { uptime } from "./lib/uptime.ts";
import { windowBounds } from "./lib/windows.ts";
import { createMonitorSchema } from "./schemas.ts";
import { InMemoryCheckStore, InMemoryMonitorStore } from "./store/memory.ts";
import type { CheckStore, MonitorStore } from "./store/types.ts";

export interface AppDeps {
  monitors?: MonitorStore;
  checks?: CheckStore;
  /** Injectable so tests can pin "now" and assert on window edges. */
  now?: () => number;
  startedAt?: number;
}

export function buildApp(deps: AppDeps = {}): FastifyInstance {
  const monitors = deps.monitors ?? new InMemoryMonitorStore();
  const checks = deps.checks ?? new InMemoryCheckStore();
  const now = deps.now ?? (() => Date.now());
  const startedAt = deps.startedAt ?? now();

  const app = Fastify({ logger: false });

  app.get("/healthz", async () => ({
    status: "ok" as const,
    uptimeSeconds: Math.floor((now() - startedAt) / 1000),
  }));

  app.post("/monitors", async (request, reply) => {
    const parsed = createMonitorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    }

    const monitor: Monitor = {
      id: randomUUID(),
      url: parsed.data.url,
      name: parsed.data.name,
      intervalSeconds: parsed.data.intervalSeconds,
      createdAt: now(),
    };
    await monitors.create(monitor);
    return reply.code(201).send(monitor);
  });

  app.get("/monitors", async () => {
    const all = await monitors.list();
    return Promise.all(
      all.map(async (monitor) => {
        const latest = await checks.latest(monitor.id);
        return {
          ...monitor,
          lastCheckedAt: latest?.at ?? null,
          up: latest?.ok ?? null,
          lastResponseMs: latest?.responseMs ?? null,
        };
      }),
    );
  });

  app.get("/monitors/:id/history", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { window = "24h" } = request.query as { window?: string };
    if (!isWindow(window)) {
      return reply.code(400).send({ error: "invalid_window", allowed: ["24h", "7d", "30d"] });
    }
    if ((await monitors.get(id)) === null) {
      return reply.code(404).send({ error: "not_found" });
    }

    const at = now();
    const { from, to } = windowBounds(window, at);
    const results = await checks.range(id, from, to);
    return { monitorId: id, window, buckets: bucketize(results, window, at) };
  });

  app.get("/monitors/:id/uptime", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { window = "30d" } = request.query as { window?: string };
    if (!isWindow(window)) {
      return reply.code(400).send({ error: "invalid_window", allowed: ["24h", "7d", "30d"] });
    }
    if ((await monitors.get(id)) === null) {
      return reply.code(404).send({ error: "not_found" });
    }

    const at = now();
    const { from, to } = windowBounds(window, at);
    const results = await checks.range(id, from, to);
    return uptime(results, window, at);
  });

  app.delete("/monitors/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const removed = await monitors.remove(id);
    if (!removed) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  return app;
}
