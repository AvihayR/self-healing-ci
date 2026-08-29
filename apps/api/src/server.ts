import { buildApp } from "./app.ts";
import { seed } from "./dev/seed.ts";
import { InMemoryCheckStore, InMemoryMonitorStore } from "./store/memory.ts";

const port = Number(process.env["PORT"] ?? 3000);
const host = process.env["HOST"] ?? "127.0.0.1";
// `--seed` rather than only an env var: npm scripts can pass argv identically on
// Windows and POSIX, where an inline env-var prefix cannot.
const withSeed = process.argv.includes("--seed") || process.env["CANARY_SEED"] === "1";

const monitors = new InMemoryMonitorStore();
const checks = new InMemoryCheckStore();

if (withSeed) {
  const startedAt = Date.now();
  await seed(monitors, checks, Date.now());
  console.log(`seeded demo data in ${Date.now() - startedAt}ms`);
}

const app = buildApp({ monitors, checks });

try {
  await app.listen({ port, host });
  console.log(`canary api listening on http://${host}:${port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
