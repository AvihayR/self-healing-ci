<div align="center">

# 🐤 self-healing-ci

**A pipeline that breaks on purpose — so an AI agent can be drilled at fixing it.**

![Node](https://img.shields.io/badge/node-%E2%89%A522-3c873a)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6)
![Tests](https://img.shields.io/badge/tests-98%20passing-1a7f37)
![Sitting](https://img.shields.io/badge/roadmap-01%20of%2012-blue)

</div>

---

## 🎯 The idea

Real pipelines fail too rarely to practise against. This one injects failures on demand,
lets a Claude agent diagnose them and open a fix PR, and scores what it got right.

A guard rejects the cheap wrong answer — deleting an assertion, adding `test.skip`,
loosening a lint rule — because a green pipeline and correct code are not the same thing.

## 🐦 Canary — the app under test

A small uptime monitor. Register URLs, a probe pings them, a dashboard shows status,
latency history and rolling availability.

Deliberately small. It exists to fail in interesting ways: 🕐 time arithmetic, 🌐 real
HTTP calls, 🔗 generated types the UI depends on.

## 🚀 Quick start

```bash
npm install
npm test        # 98 tests
npm run dev:api # :3000  (seeded with demo data)
npm run dev:web # :5173  → open http://localhost:5173
```

No database, no cloud, no config. Everything runs in memory.

## 🔌 API

| | |
|---|---|
| `POST /monitors` | register a URL |
| `GET /monitors` | list with status |
| `GET /monitors/:id/history` | latency buckets · `?window=24h\|7d\|30d` |
| `GET /monitors/:id/uptime` | rolling availability |
| `DELETE /monitors/:id` | |
| `GET /healthz` | deploy smoke test |

## 🗺️ Roadmap

- [x] **01** · Repo, app skeleton, first tests
- [ ] **02** · Reusable CI workflows
- [ ] **03** · Terraform + OIDC → staging
- [ ] **04** · Prod, approval gate, rollback
- [ ] **05** · Bedrock smoke test
- [ ] **06** · PR reviewer agent
- [ ] **07** · Failure classifier
- [ ] **08** · Healer v1 🔧
- [ ] **09** · The guard 🛡️
- [ ] **10** · Break catalogue · 22 failures
- [ ] **11** · Scorecard 📊
- [ ] **12** · Harden and present

## 📐 Layout

```
apps/api/   Fastify · TypeScript · the uptime maths
apps/web/   React · Vite · api-types.ts is generated
scripts/    contract generator
```

Arriving with the roadmap: `.github/workflows/` · `infra/` · `breaks/` · `scripts/guard/`

## 🔗 Contract

`apps/web/src/api-types.ts` is generated from the zod schemas and committed.

```bash
npm run gen:types        # after changing the contract
npm run gen:types:check  # CI fails if that was not a no-op
```
