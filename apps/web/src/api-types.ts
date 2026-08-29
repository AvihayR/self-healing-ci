// GENERATED FILE — DO NOT EDIT.
// Produced by scripts/gen-types.mjs from apps/api/src/schemas.ts.
// Run `npm run gen:types` after changing the contract; CI checks that doing so
// is a no-op, so an un-regenerated change fails the build rather than the user.

export type Window = "24h" | "7d" | "30d";

export type CreateMonitor = {
  url: string;
  name: string;
  intervalSeconds?: number;
};

export type Monitor = {
  id: string;
  url: string;
  name: string;
  intervalSeconds: number;
  createdAt: number;
};

export type MonitorStatus = {
  id: string;
  url: string;
  name: string;
  intervalSeconds: number;
  createdAt: number;
  lastCheckedAt: number | null;
  up: boolean | null;
  lastResponseMs: number | null;
};

export type Bucket = {
  start: number;
  end: number;
  total: number;
  ok: number;
  samples: number;
  p50: number | null;
  p95: number | null;
};

export type History = {
  monitorId: string;
  window: "24h" | "7d" | "30d";
  buckets: {
    start: number;
    end: number;
    total: number;
    ok: number;
    samples: number;
    p50: number | null;
    p95: number | null;
  }[];
};

export type Uptime = {
  window: "24h" | "7d" | "30d";
  from: number;
  to: number;
  total: number;
  ok: number;
  failed: number;
  ratio: number | null;
  percent: number | null;
};

export type Health = {
  status: "ok";
  uptimeSeconds: number;
};
