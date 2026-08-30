# TRL-161 — Journal

## 2026-08-29 — Initial design (TRL-160 → TRL-161)

**Did:** Drafted publish/deploy design. Decision: **Route A (managed build+host) for v1**, Route B (self-host w/ wildcard DNS + per-tenant static hosting) documented as v2 migration path. Decoupling insight: the build is the only risk-bearing step; the hosted artifact is static and trivially safe to serve.

**Key design choices:**

- Subdomain shape: `{slug}.publish.app-builder.com` (wildcard DNS + provider wildcard TLS).
- Slug rules: 3–32 chars, `[a-z0-9-]`, no leading/trailing dash, reserved-list + disposable-email-domain-blocklist, collision → auto-suffix.
- Editor toolbar gets a Publish button with state machine `idle | building | live | failed`.
- App server is a thin orchestrator; build + static serving belong to the managed provider.
- Webhook (HMAC-verified) drives `DeployStatus` transitions.
- Migration to self-host is a DNS re-point — the rest stays.

**Handoff:** Architect writes normative spec into `summary.md`. Executor implements per module layout; e2e in `e2e/publish.spec.ts`.

**Teach:** Hosting static files is the _easy_ part of "deploy." The hard part is running untrusted build commands safely. Buying that capability from a managed provider (Route A) is the right default for v1; only build it yourself (Route B) when scale or cost demands it.
