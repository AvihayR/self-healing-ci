# self-healing-ci

A sandbox repository that **breaks on purpose**, so a Claude-driven agent can be drilled
at diagnosing CI failures and opening fix PRs.

The goal is skill, not a product. Real pipelines fail too rarely and too slowly to
practise against, so this one injects failures on demand, scores what the agent does with
them, and keeps a guard in the loop that rejects the cheap wrong answer — deleting an
assertion, adding `test.skip`, loosening a lint rule — that would turn the pipeline green
while making the code worse.

**The plan is the real document.** [`docs/ci-healer-plan.pdf`](docs/ci-healer-plan.pdf)
covers the thesis, architecture, guardrails, the twenty-two-break catalogue, the scorecard
and a twelve-sitting roadmap. [`docs/ci-healer-architecture.drawio`](docs/ci-healer-architecture.drawio)
is the same system as one diagram.

## Canary — the application under test

A small uptime monitor. You register URLs, a scheduled probe pings them, and a dashboard
shows current status, response-time history and rolling availability. That is the whole
product; it is deliberately small, because the app is a substrate for failures and every
hour spent on product features is an hour not spent on the pipeline.

It was chosen for how it fails. Time arithmetic over uptime windows and partial buckets
is a rich source of subtle logic bugs. The probe makes real HTTP calls, so mocking it
gives a first-class flaky-test generator. And the UI consumes generated types, so changing
the API shape without regenerating breaks the build two directories from the edit.

## Where this is now

**Sitting 01 of twelve.** The app skeleton exists, the uptime maths has tests worth
trusting, and everything runs locally. There is no CI, no infrastructure and no agent yet
— those arrive at sittings 02, 03 and 05.

## Layout

```
apps/api/          Fastify + TypeScript service, Lambda-adapted later
apps/web/          React + Vite dashboard; api-types.ts is generated, not hand-written
scripts/           gen-types.mjs — the contract generator
docs/              the plan, the architecture diagram, and later the scorecard
```

Arriving later, per the roadmap: `infra/` (Terraform, sitting 03), `.github/workflows/`
(sitting 02), `breaks/` (sitting 10), `scripts/guard/` (sitting 09).

## Running it

Requires Node 22 or newer.

```bash
npm install
npm test          # 76 tests: node:test for the API, Vitest for the web app
npm run typecheck
npm run build
npm run dev:api   # http://127.0.0.1:3000
npm run dev:web   # http://127.0.0.1:5173
```

Nothing external is needed to run or test. Monitors and check results are held in memory
behind the `MonitorStore` and `CheckStore` interfaces; Postgres and OpenSearch arrive at
sitting 03 as implementations of those same interfaces.

### The contract

`apps/web/src/api-types.ts` is generated from the zod schemas in
`apps/api/src/schemas.ts` and committed.

```bash
npm run gen:types         # regenerate after changing the contract
npm run gen:types:check   # what CI runs — fails if regenerating is not a no-op
```

## API

```
POST   /monitors              register a URL to watch
GET    /monitors              list with current status
GET    /monitors/:id/history  bucketed response times — ?window=24h|7d|30d
GET    /monitors/:id/uptime   rolling availability
DELETE /monitors/:id
GET    /healthz               used by the deploy smoke test
```

## Two conventions worth knowing before reading the code

**All time is epoch milliseconds, UTC.** There is no `Date` in the maths modules. Every
timezone bug this project injects later should come from a place someone chose, not from
an implicit local-time conversion nobody noticed.

**Unmeasured is not the same as healthy.** A monitor with no checks reports `null`
availability, never 100%. A probe that failed to connect has `responseMs: null`, never 0.
These are the two places where a plausible-looking default would quietly turn missing data
into good news, which is the exact failure mode the whole project exists to catch.

## Why the tests matter more than the app

The healer's entire safety story rests on "the tests were green afterwards" meaning
something. Uptime calculation, bucketing and probe retry logic have real tests with real
edge cases; everything else is deliberately thin. A lab with weak tests teaches both you
and the agent the wrong lesson, and every number on the scorecard inherits that weakness.
