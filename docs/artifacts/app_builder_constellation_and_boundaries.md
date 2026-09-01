# app-builder — product constellation & web-side boundaries

**Status:** Decision record (durable) · **Date:** 2026-08-31
**Companions:** [app_builder_agent_loop_architecture.md](./app_builder_agent_loop_architecture.md), [app_builder_tool_pipeline.md](./app_builder_tool_pipeline.md)
**Trellis:** epics TRL-189 (tool loop), TRL-192 (inspector); this doc records the boundary decisions around them.

This records *why* app-builder is shaped the way it is, so the reasoning isn't
re-litigated. Three artifacts keep getting conflated; they are not the same
thing, and the differences are load-bearing.

---

## 1. The constellation

Two axes decide everything: **how it's distributed** and **what runs the code**.

|                              | **WebContainer** (browser sandbox) | **Native process** (real FS/shell) |
| ---------------------------- | ---------------------------------- | ---------------------------------- |
| **Web-deployed** (multi-tenant) | **app-builder** (Svelte)        | — *(keys can't be native on a shared server)* |
| **Local** (single machine)      | **pi-sprite/wc-react** (React, reference) | **multiplex** (React + Tauri) |

- **app-builder** — the *web* product. CodeSandbox-like. Web-only from the jump,
  because its reasons to exist require the browser sandbox:
  1. an education platform (CodeSignal / Codecademy shape),
  2. embeddable interactive Trellis tutorials on trellis.computer,
  3. an agent surface wrapping `museum-oss` for building games.
- **multiplex** (`apps/multiplex/tauri-bun-react`) — the *native* product. Began as
  a better-Warp terminal; converged on the same design. Local, real FS/shell,
  `npx`/desktop distribution (à la `npx trellis studio`).
- **pi-sprite/wc-react** (`DevTools/PI/pi-sprite/examples/webcontainer-react`) —
  **a reference/example, not a product.** Runs the Pi agent *inside* a
  WebContainer, locally, over RPC. Its own quadrant (local + WebContainer).

### Why both products exist (not one)

They differ by **distribution × runtime**, which drives real, non-cosmetic
differences: key handling, execution substrate, and what "use your own account"
can mean (see §4). The UX converges; the substrate does not. Collapsing them
would delete app-builder's reason for being (web-only, embeddable).

---

## 2. pi-sprite is the donor, not a thing to ship

Both products are chasing pi-sprite's UX — the trace, inference panel, session
sidebar, rich composer, the workspace. You **harvest** pi-sprite three ways, and
each port asks *which kind it is*:

| Harvest as        | What                                                                                   | Where it goes |
| ----------------- | -------------------------------------------------------------------------------------- | ------------- |
| **UX** (reimplement) | trace views, inference panel, composer, session sidebar                              | Svelte in app-builder; React in multiplex |
| **Core** (extract-shared) | `sessionEventLog`, `deriveSessionView`, `summarizeToolCall`, `traceWaterfall`, run-envelope folding, inference-param logic | framework-agnostic TS both products consume |
| **Runtime** (leave)   | RPC client, bridge relay, in-container Pi, `pi.mjs`                                  | stays in pi-sprite; adopted by neither as-is |

The core is the anti-duplication move: **two products sharing a heart**, not the
same thing rebuilt twice. This session's code was written with the split latent
(pure logic in `.ts`, runes/components separate), so it's extraction-ready.

---

## 3. app-builder web-side decisions

- **WebContainer is the execution substrate — deliberately, and we avoid
  e2b / cloud-sprite services.** app-builder started partly as an experiment in
  how far WebContainers can be pushed for exactly this reason. Cloud sandboxes
  are the thing we're proving we don't need.
- **Hybrid agent loop, not in-container Pi.** Model call runs **server-side**
  (`api/chat`); tools run **client-side** where the WebContainer FS lives; the
  loop is ai-sdk resubmit. See `app_builder_tool_pipeline.md` §1. Reasons: keys
  stay server-side (web deploy), backend portability (Bun + WebContainer), and
  we own the agent's semantics (allowlist, approval, session log → Trellis sync).
- **Own the loop.** The spine — SessionEvent log, tool pipeline, approval seam,
  run envelope — is app-builder's, not an embedded third-party agent. Pi is a
  capability reference, not the runtime.
- **The execution sandbox and model auth are orthogonal axes.** WebContainer
  runs the code; the model is a separate server-proxied concern. Avoiding
  e2b/sprites constrains neither.

---

## 4. Model access & auth (web)

The credential **never touches the browser or the WebContainer** — it stays
server-side and `api/chat` proxies. This is itself a reason the hybrid loop is
correct for the web product.

| Model | Who pays | Web-viable? | Notes |
| ----- | -------- | ----------- | ----- |
| **Operator key** | you | ✅ | Default for education / embedded tutorials (use cases 1 & 2). Rate-limit it. |
| **BYOK — user API key** | user | ✅ | User pastes an API key (OpenRouter = one key, many models); stored server-side per-user, proxied. For power users / use case 3. |
| **User consumer *subscription*** (Claude Max, ChatGPT Plus, Gemini Advanced) | user | ❌ | First-party-scoped credentials; using them from a third-party web app is outside their scope / ToS. No "log in with ChatGPT Plus" API exists. |
| **OAuth → user's own API account** | user | 🔶 emerging | Sanctioned "users pay their own way" without you holding a key; provider-specific, nascent, still API-account (not subscription). Track, don't build on yet. |

**The key insight:** pi-sprite's "Loaded from Claude Code (host Keychain)" works
*only* because it runs **locally** and reads the OAuth token the installed Claude
Code CLI left in the OS keychain. A browser has no keychain, no host machine, no
local CLI — so **"use your own Claude/ChatGPT subscription" is a *native*
capability that belongs to multiplex, not app-builder.** Yet another clean line
between the two products.

---

## 5. Migration in flight (Path A)

Porting pi-sprite's portable features onto app-builder's hybrid loop, web-only.
Every phase is architecture-independent (the fork only bites at the agent
driver, which app-builder answers with the hybrid):

- **Phase 0 — done.** `/workspace` route + left-rail entry; panel shell with a
  live Sessions rail over the durable log.
- **Phase 1 — done.** Session-log upgrade: every event now carries a `source`
  (`ui`/`agent`/`bridge`/`run` — `rpc`→`agent` for the ai-sdk runtime) and a
  `policy` tier (`durable`/`realtime`/`derived`), stamped from `kind` at append
  and backfilled on read. `selectDurable` exposes the authoritative sync surface
  (the Trellis-sync + retention tier). Pure/tested (38/38); the spine of the
  shared core. Files: `agent/session/events.ts`, `agent/session/log.ts`.
- **Phase 2 — done.** Trace waterfall: `traceWaterfall.ts` folds the log into
  positioned spans (turn spans by `turnId`, tool spans by `tool/call`→`tool/result`
  pairing, `fs/observed` markers), style-agnostic (returns a `semantic`, view
  colours it). `trace-waterfall.svelte` renders it; wired into the `/workspace`
  Trace panel, live. Pure/tested (45/45). Files: `agent/session/traceWaterfall.ts`,
  `components/trace-waterfall.svelte`.
- **Phase 3 — done.** Inference config: pure `inference/params.ts` (types,
  defaults, `sanitizeInferenceParams` clamping, `thinkingToOllama`), a persisted
  runes store (`inference/settings.svelte.ts`), sent in the `api/chat` body and
  **re-sanitized server-side** before `streamText` (temperature/topP/maxOutputTokens/
  stop + thinking level). Inference overrides variant thinking when present, absent
  keeps the experiment arm. `inference-controls.svelte` in the `/workspace` panel.
  Pure/tested (52/52).
- **Phase 4 — rich composer.** slash commands, @-refs, attachments, sfx.

**Not migrated** (pi-sprite runtime, §2 "leave"): `pi.mjs`, `piRpcClient`,
`bridgeRelay`, `bridge-proxy`, in-container LLM relay.
