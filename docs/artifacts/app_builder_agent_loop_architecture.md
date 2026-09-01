# Architecture: app-builder agent loop

**Status:** Draft (design → architect)
**Parent:** TRL-150 · agent harness · **Companion to:** [app_builder_agent_harness_design.md](./app_builder_agent_harness_design.md) (UI/tokens)
**Scope:** Answers the "Open for Architect" item #6 (*agent loop boundary*) and #1/#3/#4 (transport, observation, snapshots) from the design doc.
**References studied:**

- `pi-sprite/examples/webcontainer-react` — a working in-container agent (Pi RPC over stdio) with a hand-rolled turn-stream client.
- `DEEPSEEK-HARNESS/deepseek-harness` — a mature agent-loop reference: session-event log, two event planes, turn/step lifecycle, guarded tool pipeline, capability seams.

---



## 1. Problem statement

The harness today has loop **primitives** but no loop. Concretely, in `src/lib/agentHarness/`:

- `types.ts` — `HarnessEnvelope`: a versioned postMessage bridge (`emit` fire-and-forget, `call` = `read`/`write` RPC).
- `pathAllowlist.ts` — `isGuestPathWritable()`: allow/deny regex guard.
- `harnessStore.svelte.ts` — `toolLog: ToolLogEntry[]`, rail UI state, HMR timing.
- `snapshotStore.ts` — ring-buffer rollback.
- `bridge.ts` — installs the postMessage host↔guest FS proxy.

Plus, outside the harness namespace, three **parallel, unlinked** stores of truth:

1.  chat messages (`chat.svelte.ts`),
2. the tool log (`harnessStore.toolLog`),
3. file snapshots (`snapshotStore.ts`).

The chat is "dumb" because nothing drives these from a model, and because they are three stores that *will drift*. This doc specifies the loop that unifies them.

---



## 2. Core idea: one session-event log

> **Rule (from deepseek-harness): "model-visible means logged."** Anything that reaches a model request must be reconstructable from a single append-only event log. Chat transcript, tool log, telemetry, and undo all *derive* from that log — they are not maintained independently.

Replace the three parallel stores with **one** `SessionEvent[]` **per project**, persisted to Dexie (already in the stack via `dexieProjectStore`).

```ts
// src/lib/agent/session/events.ts (new)
export type SessionEvent =
  | { seq: number; ts: number; kind: 'turn/start';       turnId: string }
  | { seq: number; ts: number; kind: 'user/message';     turnId: string; text: string }
  | { seq: number; ts: number; kind: 'assistant/chunk';  turnId: string; stepId: string; delta: string }
  | { seq: number; ts: number; kind: 'assistant/message'; turnId: string; stepId: string; text: string; usage?: Usage }
  | { seq: number; ts: number; kind: 'tool/call';        turnId: string; stepId: string; callId: string; name: string; args: unknown }
  | { seq: number; ts: number; kind: 'tool/result';      turnId: string; stepId: string; callId: string; ok: boolean; result?: unknown; error?: string }
  | { seq: number; ts: number; kind: 'fs/observed';      turnId: string; callId: string; path: string; op: 'write' | 'delete'; snapshotId: string }
  | { seq: number; ts: number; kind: 'turn/end';         turnId: string };
```

Derivations (all pure functions over the log):


| View                              | Derivation                                              |
| --------------------------------- | ------------------------------------------------------- |
| Chat transcript                   | fold `user/message` + `assistant/message`               |
| Model history (what we resend)    | `deriveMessages(log)` — assistant + user + tool results |
| Tool log (`harnessStore.toolLog`) | filter `tool/*`, `fs/observed`                          |
| Preview glow / last write         | last `fs/observed.path`                                 |
| Undo / rollback                   | `fs/observed.snapshotId` chain                          |
| Telemetry / cost                  | fold `assistant/message.usage`                          |


**Payoff:** because the log is per-project and durable, agent sessions **resume and fork** for free — exactly what a multi-project IDE wants. `session.fork(atSeq)` = branch a conversation from any point.

---



## 3. Two event planes (keep them sharply separate)

deepseek-harness's central discipline: **durable facts** vs **live coordination**.


| Plane              | Nature                                | Examples                                                                | Home in app-builder           |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| **Session events** | Durable, append-only, survives reload | `user/message`, `tool/call`, `fs/observed`                              | Dexie-backed `SessionEvent[]` |
| **Agent status**   | Ephemeral, live control               | `running`/`idle`, streaming deltas mid-flight, HMR ms, approval-pending | `$state` in `harnessStore`    |


Your `HarnessEnvelope` already half-encodes this (`emit` vs `call`). Formalize it: **UI renders the transcript from the durable log; status badges read the live plane.** A streaming delta is live until the turn closes, at which point the coalesced `assistant/message` is the durable fact.

---



## 4. Turn / step lifecycle

A **step** = one model request + the tools it calls. A **turn** = zero-or-more steps; opens when input is claimed, closes when nothing is owed.

```text
turn/start
  claim inbox (user message + any injected context)
  → pre-step        [seam] reject | rewrite | enter(messages)
  step/start
    assemble system prompt + tool schemas
    → request        [seam] build the LLM call
    → stream         assistant/chunk*  →  assistant/message
    tool/call* → [pre-execute] → [execute] → [post-execute] → tool/result*
  step/end
  (tools owe another request, or new inbox input) → next step
  → turn-stopping   [serial seam]
turn/end
```

**You can lift pi-sprite's** `PiRpcClient.streamAssistantReply()` **almost verbatim** — it already is this loop with different event names:


| pi-sprite event                     | app-builder session event           |
| ----------------------------------- | ----------------------------------- |
| `turn_start`                        | `turn/start`                        |
| `message_update` / `text_delta`     | `assistant/chunk`                   |
| `message_update` / `toolcall_start` | `tool/call`                         |
| `message_end`, `turn_end`           | `assistant/message`                 |
| `agent_settled`                     | `turn/end`                          |
| `auto_retry_end {success:false}`    | (drives `agent/request-error` seam) |


The pi-sprite client's `send()` id-correlation + timeout, `on()` pub/sub dispatch, and settle-timeout are all reusable machinery regardless of where the loop runs (§7).

---



## 5. Tool pipeline as ordered seams

You already have every piece — inline and unordered. Reorder them into the harness's pipeline so policy can grow without touching the write path.

```text
tool/call
  → pre-execute    guard + approval        ← pathAllowlist.isGuestPathWritable() + NEW approval prompt
  → execute        the write (timeout/retry wrapper)   ← bridge.ts host FS proxy
  → post-execute   observe + snapshot      ← snapshotStore ring buffer + HMR timing
  → tool/result    frozen outcome (logged as session event)
```

Concretely:

```ts
// src/lib/agent/tools/pipeline.ts (new) — orchestrates existing pieces
async function runTool(call: ToolCall, ctx: ToolCtx): Promise<ToolResult> {
  const gate = await preExecute(call, ctx);        // allowlist → approval → deny|allow
  if (gate.denied) return denied(call, gate.reason); // logged as tool/result ok:false
  const snapshotId = ctx.snapshot();               // BEFORE the write (post-order records it)
  const raw = await withTimeout(execute(call));     // existing bridge write path
  return postExecute(call, raw, { snapshotId });    // fs/observed + HMR observe
}
```

**Why lift the allowlist out of** `bridge.ts`**:** today the check is inline in the write proxy. As a `pre-execute` seam it composes with:

- **approval** (§6),
- rate-limits,
- repeat-tool detection ("agent wrote App.svelte 4× in a row"),

…none of which should require editing the FS proxy.

---



## 6. Approval seam (highest value / least code)

For an agent editing the **user's** files, a one-shot approval is the single best AX win.

```
┌─────────────────────────────────────────┐
│  Agent wants to write  components/Foo.svelte │
│  + 34 lines                                   │
│                                              │
│   [ Allow ]  [ Allow all this turn ]  [ Deny ] │
└─────────────────────────────────────────┘
```

- Resolves inside `pre-execute`, **before** the allowlist guard's write.
- Absent/unanswerable ⇒ deny (fail closed).
- "Allow all" scoped to the current `turnId`, held in the live plane.
- A denied approval is still a durable `tool/result {ok:false}` so the model sees it and can adapt.

This maps to `ctx.approval` in the harness and slots in with ~one component + one promise.

---



## 7. The one decision: where does the loop live?


| Option                                 | Mechanism                                                                                             | Trade                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. In-container** (pi-sprite's path) | Agent runs as RPC server inside the WebContainer; host drives via stdio client                        | Fastest to a real agent; native FS + shell. Couples you to Pi's protocol + container lifecycle. Keys must reach the container (pi-sprite proxies `/api/`* through Vite). |
| **B. Host-side** (SvelteKit)           | Loop runs in `src/routes/api/chat/+server.ts`; drives container via existing `HarnessEnvelope` bridge | Reuses your bridge, `@ai-sdk/svelte`, `ai-sdk-ollama`; keys stay server-side. You implement tools (write/read/exec) against the seam.                                    |
| **C. Hybrid**                          | Host orchestrates; container is a pure execution seam                                                 | Most flexible, most work.                                                                                                                                                |


**Recommendation: B (host-side loop + container as execution seam).**

Rationale from your existing inventory: you *already* have `api/chat/+server.ts`, `@ai-sdk/svelte`, `ai-sdk-ollama`, and the postMessage bridge. Option B makes the **session log server-authored** (natural durability + no key exposure) and keeps the WebContainer as what it is best at — execution + preview. pi-sprite's in-container Pi is the faster demo, but it's a *different long-term bet*: you'd be embedding Pi rather than growing your own harness. Keep pi-sprite as the reference for the turn-stream client shape, not the deployment model.

### Capability seam that makes B safe

Put every tool behind **one FS/exec interface** so the same agent runs on both backends (Bun sandbox *and* WebContainer):

```ts
// src/lib/agent/exec/backend.ts (new)
interface ExecBackend {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exec(cmd: string[], opts?: ExecOpts): Promise<ExecResult>;   // future: shell tools
}
// providers: BunSandboxBackend (server/sandboxManager.ts), WebContainerBackend (bridge.ts)
```

> deepseek-harness rule: *"point FS + subprocess at a remote sandbox and Bash/PTY/LSP all move with them."* Do this **before** the tool count grows, or you fork every tool per backend. You already solved this seam conceptually (Bun vs WC auto-detect in `sandboxStore`) — make it explicit for the agent's tools.

---



## 8. Defensive rules that will bite in this exact domain

Lifted from `deepseek-harness/docs/defensive-patterns.md` — each is a class of bug that shipped there:

1. **Async state is not sync state.** Do NOT treat one `send()` or one `running→idle` transition as one message's result. Queued prompts + steering + injected context share a single `running` interval. Define a run's interval explicitly (from durable inbox receipt to whole-agent idle). *This is the bug your chat UI will hit first.*
2. **Contain callback exceptions in the dispatcher.** One throwing listener in the `on()` pub/sub loop must not starve the rest — wrap dispatch in try/catch + log. (pi-sprite's `PiRpcClient.dispatch` currently does not.)
3. **Dispose must reach quiescence.** WebContainer teardown must `kill → await done`, and close notification registries *before* killing so late completions stay silent.
4. **Report orthogonal outcomes independently.** A tool run can time out AND exit 0. Surface `timedOut`, `exitCode`, `error` separately on `tool/result`; never nest one flag inside another's branch.
5. **Scrub env for spawned commands** (once §7's `exec` lands): drop `*KEY`*/`*SECRET*`/`*TOKEN*` so harness credentials never leak into agent-visible output.

---



## 9. Mapping onto current code


| New concept        | Lands in                                         | Reuses / replaces                                                                                        |
| ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `SessionEvent` log | `src/lib/agent/session/` (new)                   | replaces parallel `chat.svelte.ts` + `toolLog` + `snapshotStore` as *sources*; they become derived views |
| Dexie persistence  | extend `projects/dexieProjectStore.ts`           | new `sessionEvents` table keyed by projectId                                                             |
| Turn/step driver   | `src/lib/agent/loop/` (new)                      | port `PiRpcClient.streamAssistantReply` shape                                                            |
| Model call         | `src/routes/api/chat/+server.ts`                 | `@ai-sdk/svelte`, `ai-sdk-ollama` (already present)                                                      |
| Tool pipeline      | `src/lib/agent/tools/pipeline.ts` (new)          | orders `pathAllowlist` + `snapshotStore` + `bridge` write                                                |
| Approval seam      | `src/lib/components/agent-approval.svelte` (new) | renders from live plane                                                                                  |
| Exec backend seam  | `src/lib/agent/exec/backend.ts` (new)            | wraps `bridge.ts` + `server/sandboxManager.ts`                                                           |
| Live status        | `harnessStore.svelte.ts`                         | keep as the live plane; drop `toolLog` as a *store* (derive it)                                          |


---



## 10. Phased sequencing

1. **Log first.** Introduce `SessionEvent` + Dexie table + derived transcript/tool-log selectors. Make the *current* dumb chat render from the log. No model yet. (De-risks the "three stores drift" problem immediately.)
2. **Host loop.** Wire `api/chat` turn/step driver; emit `assistant/chunk` → `assistant/message`. Chat becomes streaming + real.
3. **Tool pipeline.** Move allowlist into `pre-execute`; snapshot into `post-execute`; log `tool/call`/`tool/result`/`fs/observed`. Agent can now edit guest files with rollback.
4. **Approval seam.** One-shot prompt in `pre-execute`.
5. **Exec backend seam.** Abstract FS/exec so the agent runs on Bun sandbox and WebContainer identically; opens the door to shell tools.
6. **Resume/fork.** Expose `session.fork(atSeq)` in the UI — branch conversations, retry from a point.

Each phase is independently shippable and leaves the harness in a working state.

---



## Open questions for architect

1. **Prompt assembly** — static system prompt v1, or a `system-prompt/assemble` waterfall (project context, open files, manifest) from day one?
2. **Compaction** — defer, or reserve the `pre-step` + `request-error` hook points now so context-overflow handling has a home later?
3. **Steering** — do we need mid-turn injection (`agent.inject()`) in v1, or is per-turn input enough?
4. **Backend default for the agent** — Bun sandbox when present (faster), WC fallback — same auto-detect as preview, or pin the agent to one backend for determinism in v1?

