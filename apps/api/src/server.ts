import { buildApp } from "./app.ts";

const port = Number(process.env["PORT"] ?? 3000);
const host = process.env["HOST"] ?? "127.0.0.1";

const app = buildApp();

try {
  await app.listen({ port, host });
  console.log(`canary api listening on http://${host}:${port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
