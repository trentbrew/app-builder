# trellis-pipeline (pi port)

Single-tab Trellis pipeline auto-advance for the **pi** harness — the pi
equivalent of the `.cursor` stop-hook pipeline (`strategist → designer? →
architect → executor ⇄ reviewer → strategist`).

It does **not** reimplement the pipeline. It reuses the engine-agnostic Node
logic already installed for Cursor and wires it into pi's extension events.

## Reused engine (unchanged)

| File | Provides |
| --- | --- |
| `~/.trellis/pipeline-core/pipeline-run.mjs` | `runPipelineStop()` — parse envelope, gate, rebind next role, build followup |
| `~/.cursor/hooks/trellis-profile-lib.mjs` | session bindings (`~/.cursor/trellis-profiles/sessions/<id>.json`) |
| `~/.cursor/hooks/trellis-agent-verify-lib.mjs` | UI smoke gate (`.agent/verify.json`, `scripts/agent-smoke.mjs`) |
| `~/.cursor/skills/trellis-agent-*`, `trellis-handoffs` | role instructions (paths injected into each handoff) |

## Cursor → pi mapping

| Cursor mechanism | pi API |
| --- | --- |
| `stop` hook (agent finished) | `pi.on("agent_settled")` |
| return `{ followup_message }` | `pi.sendUserMessage(msg)` (idle ⇒ triggers next turn) |
| UI-touch tracker hook | `pi.on("tool_call")` — records `edit`/`write` paths hitting `uiGlobs` |
| `/tp`, `/tr-pipeline` commands | `pi.registerCommand(...)` |
| session binding JSON | same store, keyed by pi session id |
| loop_limit | in-extension `MAX_HOPS` guard (24), reset on each human prompt |

## Use

```
/tp on            # or /tr-pipeline on, /trellis-pipeline on
Start TRL-34 — configure views tab
```

Then end **every pass** with a turn banner + YAML footer (per `trellis-handoffs`):

```
## 🟣 TURN <role> · stage <stage> · <STATUS> · <issue>
from: <role>
to: <next_role>
re: <issue>
status: <STATUS>
```

- `HANDOFF` / `REJECT` → auto-advance (rebind next role, inject its skill path,
  submit the handoff).
- `BLOCKED` / `CLARIFY` / ambiguous `DECISION` → pause for the human (notified).
- Executor/reviewer/designer **verification gates** stay strict — a `HANDOFF`
  without the required `## Verification` evidence is bounced back, not advanced.
- If you edited UI files (`src/**/*.svelte|css`, `src/routes/**`, …), the
  **smoke gate** runs `bun scripts/agent-smoke.mjs` before advancing; a failure
  re-prompts and blocks completion until it exits 0.

Toggle off: `/tp off`.

## Notes / limitations

- Bindings are shared with the Cursor install (same session store) but keyed by
  pi's session id, so pi and Cursor sessions never collide.
- Shell-evidence enrichment (`generation_id` scoped command logs) is not wired;
  gates rely on the assistant's `## Verification` block text, which the parser
  already reads. Add a `tool_result` bash logger later if you want per-command
  exit-code evidence.
- Requires the Cursor install present at `~/.cursor` and `~/.trellis`. If those
  are missing the extension no-ops (with a notify on the toggle command).
