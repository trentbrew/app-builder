# TRL-154 / TRL-155 — Journal

## 2026-08-29 — Architect spec (TRL-156)

**Did:** Wrote normative spec `docs/issues/TRL-155/summary.md` from design artifacts (`app_builder_multi_project_design.md`, mockup). Defined ProjectStore, per-project Dexie snapshots, template registry (svelte/vue/nextjs), routes, switch lifecycle, agent template guard.

**Handoff:** Executor implements per module layout; e2e `e2e/multi-project.spec.ts`.

**Teach:** Sequential WC switching = save tagged snapshot → teardown → restore by `projectId`. Dashboard reads Dexie only — never blocks on boot.
