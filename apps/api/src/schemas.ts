import { z } from "zod";

/**
 * The contract. These schemas are the single source of truth for runtime
 * validation and for the types the web app consumes — `npm run gen:types`
 * derives `apps/web/src/api-types.ts` from exactly this file, and CI later
 * checks that regenerating is a no-op.
 */

export const windowSchema = z.enum(["24h", "7d", "30d"]);

export const createMonitorSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(120),
  intervalSeconds: z.number().int().min(60).max(86_400).default(300),
});

export const monitorSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  intervalSeconds: z.number(),
  createdAt: z.number(),
});

export const monitorStatusSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  intervalSeconds: z.number(),
  createdAt: z.number(),
  lastCheckedAt: z.number().nullable(),
  up: z.boolean().nullable(),
  lastResponseMs: z.number().nullable(),
});

export const bucketSchema = z.object({
  start: z.number(),
  end: z.number(),
  total: z.number(),
  ok: z.number(),
  samples: z.number(),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
});

export const historySchema = z.object({
  monitorId: z.string(),
  window: windowSchema,
  buckets: z.array(bucketSchema),
});

export const uptimeSchema = z.object({
  window: windowSchema,
  from: z.number(),
  to: z.number(),
  total: z.number(),
  ok: z.number(),
  failed: z.number(),
  ratio: z.number().nullable(),
  percent: z.number().nullable(),
});

export const healthSchema = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number(),
});

/** Named exports the generator walks. Order here is the order in the output. */
export const contract = {
  Window: windowSchema,
  CreateMonitor: createMonitorSchema,
  Monitor: monitorSchema,
  MonitorStatus: monitorStatusSchema,
  Bucket: bucketSchema,
  History: historySchema,
  Uptime: uptimeSchema,
  Health: healthSchema,
} as const;

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type MonitorStatusOutput = z.infer<typeof monitorStatusSchema>;
