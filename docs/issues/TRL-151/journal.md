# TRL-151 — app-builder agent harness

## 2026-08-28 — Designer complete (TRL-151)

**Did:** Design artifacts — `app_builder_agent_harness_design.md`, mockup, token parity script. 13-row interaction matrix; iframe guest boundary; AgentRail collapse.

**Why:** TRL-150 proposal requires UX spec before architect spec.

**Look at:** `docs/artifacts/app_builder_agent_harness_design.md` · `docs/artifacts/app_builder_agent_harness_mockup.html`

**Evidence:** design.md lint exit 0 · token parity exit 0 · trellis issue check TRL-151 10/10

**Next:** Architect spec (TRL-152)

## 2026-08-28 — Architect spec (TRL-152)

**Did:** Spec TRL-152 from TRL-151 design — two-shell harness, SDK v1 envelope, path allowlist, in-memory snapshotStore, AgentRail + mount contract.

**Why:** Encode design interaction matrix as testable AC for Executor.

**Look at:** `docs/issues/TRL-151/summary.md` · `docs/issues/TRL-151/visuals/agent-harness-flow.mmd`

**Evidence:** `trellis issue create TRL-152` · static AC wired

**Next:** Executor implements harness modules + e2e scaffold

## 2026-08-28 — Executor impl (TRL-152)

**Did:** Implemented agent harness — `agentHarness/*` modules, AgentRail/HarnessStatus/ToolLog UI, guest SDK mount, path allowlist, snapshot rollback, postMessage bridge, preview iframe title + glow, `e2e/agent-harness.spec.ts`.

**Why:** TRL-152 spec — two-shell host/guest self-authoring wedge.

**Look at:** `src/lib/agentHarness/` · `src/lib/components/agent-rail.svelte` · `src/routes/(app)/+layout.svelte` · `src/lib/webcontainerProject.ts`

**Evidence:** `npx vite build` exit 0 · `trellis issue check TRL-152` pass · token parity exit 0

**Next:** Reviewer verifies behavioral AC + e2e
