---
version: alpha
name: app-builder-agent-harness
description: Design artifact for TRL-150 — host/guest agent harness with self-authoring Svelte UI in WebContainer preview
omitted:
  - spacing
colors:
  background: "oklch(0.145 0 0)"
  foreground: "oklch(0.985 0 0)"
  card: "oklch(0.205 0 0)"
  card-foreground: "oklch(0.985 0 0)"
  primary: "oklch(0.922 0 0)"
  primary-foreground: "oklch(0.205 0 0)"
  secondary: "oklch(0.269 0 0)"
  muted: "oklch(0.269 0 0)"
  muted-foreground: "oklch(0.708 0 0)"
  accent: "oklch(0.269 0 0)"
  destructive: "oklch(0.704 0.191 22.216)"
  border: "oklch(1 0 0 / 10%)"
  ring: "oklch(0.556 0 0)"
  status-bar: "oklch(0.58 0.17 48)"
  guest-canvas: "#0f0f12"
  agent-glow: "oklch(0.58 0.17 48 / 25%)"
typography:
  body:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: 14px
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace"
    fontSize: 12px
rounded:
  lg: 0.65rem
components:
  hostShell:
    backgroundColor: "{colors.background}"
    borderColor: "{colors.border}"
    textColor: "{colors.foreground}"
  guestFrame:
    backgroundColor: "{colors.guest-canvas}"
    borderColor: "{colors.agent-glow}"
  agentRail:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.border}"
    textColor: "{colors.card-foreground}"
  statusBar:
    backgroundColor: "{colors.status-bar}"
    textColor: "{colors.primary-foreground}"
  primaryAction:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  harnessBadge:
    typography: mono
    textColor: "{colors.muted-foreground}"
    borderColor: "{colors.border}"
  destructiveAction:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.foreground}"
  accentSurface:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground}"
---

# Design: app-builder self-authoring agent harness

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-150 · **Design issue:** TRL-151  
**Mock:** [app_builder_agent_harness_mockup.html](./app_builder_agent_harness_mockup.html)  
**Source:** greenfield · globals: `src/app.css`

---

## Overview

App-builder already boots a WebContainer Svelte repl (editor + preview + logs). This wedge adds an **agent harness** where the **host shell stays invariant** and the **guest app** (inside the preview iframe) is a living artifact the agent composes from modular Svelte components in realtime.

**Posture:** Two-shell architecture — host owns agent loop, tools, memory, and observation; guest owns task-specific UI the agent authors via hot-write + Vite HMR. The harness is the runtime; the guest UI is the artifact.

**Emotional tone:** Host feels like a workshop bench — stable, instrumented, trustworthy. Guest feels like a morphing instrument panel — the agent reshapes controls for the task at hand without rebooting the world.

**Non-goals (v1):** Agent editing host chrome; full IDE self-authoring; Trellis kernel sync; cloud relay.

---

## Colors & tokens

Inherit `src/app.css` shadcn dark theme. Harness-specific accents:

| Surface | Token | Usage |
| ------- | ----- | ----- |
| Host workspace | `background`, `border` | Editor dock, file tree, terminal |
| Agent rail | `card`, `border` | Right column — chat, tool log, harness status |
| Guest preview frame | `guest-canvas`, `agent-glow` | iframe border tint when agent last wrote |
| Status bar | `status-bar` | Boot phase, HMR state, lane id |
| SDK badge | `muted-foreground`, `mono` | "guest · read-only SDK" label on preview |

---

## Typography

| Copy | Style | Where |
| ---- | ----- | ----- |
| Pane labels | `font-mono text-xs uppercase tracking-wide` | Editor, Preview, Agent, Terminal |
| Harness phase | `font-mono text-xs` | Status bar — `HMR · 240ms` |
| Guest slot labels | `text-sm font-medium` | Agent-authored panel titles in preview |
| Tool transcript | `font-mono text-xs text-muted-foreground` | Agent rail — write/emit events |

---

## Layout

### Two-shell anatomy (normative)

```
HostShell (SvelteKit — invariant v1)
├── AppHeader (Run, Reboot, breadcrumb)
├── Workspace (horizontal)
│   ├── IconRail (nav)
│   ├── EditorDock (CodeMirror — agent may edit guest files only)
│   ├── PreviewFrame
│   │   └── iframe → GuestApp (WebContainer / Vite HMR)
│   └── AgentRail (320px, collapsible)
│       ├── AgentChat (composer + transcript)
│       ├── HarnessStatus (boot, last write, snapshot id)
│       └── ToolLog (structured events from guest emit)
└── Terminal + StatusBar
```

### Guest app anatomy (agent-authored zone)

```
GuestApp (WebContainer mount — agent editable)
├── agent.manifest.json (declares slots + capabilities)
├── lib/agent-sdk/ (host-injected at mount — agent never edits)
├── components/ (agent creates/edits)
│   ├── TaskPanel.svelte
│   ├── MemoryView.svelte
│   └── ...
└── App.svelte (composes slots: main | sidebar | status)
```

### Slot contract (v1)

| Slot | Default | Agent may |
| ---- | ------- | --------- |
| `main` | Counter demo | Replace with task UI |
| `sidebar` | empty | Add inspector / tool palette |
| `status` | empty | Add compact status strip |

---

## Elevation & Depth

- **Host panes:** existing card/inset hierarchy from `editor-pane-style=cards` — guest preview gets **agent-glow** border for 2s after agent write (decays).
- **Guest UI:** flat dark canvas (`#0f0f12`) — agent components use minimal elevation; host must not style guest innards.

---

## Shapes

- Host: `--radius: 0.65rem`, `--editor-pane-radius`
- Guest: agent chooses; SDK provides optional `Button`, `Panel` primitives in v2 — v1 uses raw Svelte + scoped CSS

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **HostShell** | header + workspace + terminal | booting, ready, error | `(app)/+layout.svelte`, `app-shell` |
| **EditorDock** | tabs + CodeMirror | dirty, saving | `editor-dock.svelte`, `(app)/editor/+page.svelte` |
| **PreviewFrame** | label + iframe + overlay badge | loading, live, hmr-pending | preview pane in editor layout |
| **AgentRail** | chat + status + tool log | collapsed, open | **new** — extends icon-rail pattern |
| **HarnessStatus** | phase, last path, snapshot | idle, writing, hmr, error | **new** — binds `sandboxStore` / `webcontainerStore` |
| **GuestApp** | App.svelte + slots | compile-error, live | `webcontainerProject.ts`, `initialCode.ts` |
| **AgentSDK** (guest) | callTool, emit, subscribe, context | — | **new** — injected module, not agent-editable |

---

## Design research

In-repo references read for this wedge:

| Ref | Path | Relevant surface |
| --- | ---- | ---------------- |
| Sandbox facade | `src/lib/sandboxStore.ts` | `write()`, `boot()`, backend abstraction |
| Editor layout | `src/lib/components/editor-dock.svelte` | HorizonLayout panes: editor, preview, logs, terminal |
| Preview chrome | `src/lib/components/preview-pane.svelte` | PaneChrome toolbar, boot phase, error overlay |
| Guest mount | `src/lib/webcontainerProject.ts` | `createWebContainerMount(appContents)` tree |
| Action context | `src/lib/actionSnapshots.ts` | Layout + sandbox snapshot pattern for rollback v2 |
| Global tokens | `src/app.css` | `--color-background`, status bar orange, pane cards |

---

## Interaction matrix

| Actor | Input | System response | Output / observation |
| ----- | ----- | --------------- | -------------------- |
| Agent | `edit_component(path, content)` | `sandboxStore.write` → Vite HMR | Preview updates; status bar shows `HMR · Nms` |
| Agent | `snapshot()` | Ring buffer entry before write | Snapshot id in HarnessStatus; rollback enabled |
| Agent | `rollback(snapshotId)` | Restore guest files from buffer | Preview reverts; toast in host |
| Agent | `edit_component('lib/agent-sdk/...')` | Allowlist deny — no write | Toast + ToolLog `[deny]`; preview unchanged |
| Guest UI | User clicks button with `emit({ type, payload })` | `postMessage` → host ToolLog | Agent loop receives structured event |
| Guest UI | `callTool('read', { path })` | Host proxies to sandbox FS | Promise resolves in guest |
| Human | Edit guest file in EditorDock | Same write path as agent | No reboot; Run not required if HMR |
| Human | Toggle AgentRail collapse | Rail animates 320px ↔ 48px (or overlay \<lg) | Preview regains space; focus on collapse trigger |
| Human | Click rollback in HarnessStatus | Host restores last snapshot | Guest preview reverts; ToolLog `[rollback]` |
| Human | Reboot | Full WebContainer remount | Guest resets to last mounted tree |
| System | Vite compile error | Error overlay in preview iframe + log | Agent observes via `[iframe-error]` prefix |
| System | Boot timeout | Preview error panel (existing) | Agent receives phase + logs |
| System | First boot (empty ToolLog) | HarnessStatus idle copy | Placeholder: "No agent events yet" |

---

## Accessibility

**Focus order (host):** IconRail → EditorDock tabs → editor surface → PreviewFrame (iframe traps focus when focused) → AgentRail composer → Terminal.

**Labels:**
- Preview iframe: `title="Agent guest preview"`.
- **Single** live region: status bar only (`aria-live="polite"`) for boot phase + HMR timing. HarnessStatus is static text (`aria-describedby` optional). ToolLog appends may use separate polite region.
- AgentRail collapse: `aria-expanded`, `aria-controls="agent-rail-panel"`, focusable `<button>` trigger.
- Guest components: agent-authored — SDK docs require `aria-label` on interactive controls; host linter warns on `emit` from unlabeled buttons (v2).

**Motion:** Respect `prefers-reduced-motion` — disable agent-glow pulse and HMR timing animation; instant border tint only.

**Contrast:** Host inherits shadcn tokens (WCAG AA). Guest agent UI is agent responsibility; SDK ships accessible `Button` primitive in v2.

---

## Open for Architect

1. **SDK transport:** `postMessage` bridge schema for `emit`, `callTool`, `subscribe` — versioned envelope `{ v: 1, type, payload }`.
2. **Editable path allowlist:** `guest/**` only; deny `lib/agent-sdk/**`, `agent.manifest.json` keys (agent may edit manifest values not schema).
3. **Observation channel:** Extend existing iframe log hook with `{ type: 'ui', name, payload }` and compile errors from Vite.
4. **Snapshot store:** Dexie or in-memory ring buffer before each agent write; rollback API on host.
5. **Mount contract:** `createWebContainerMount` adds `lib/agent-sdk/` + default `agent.manifest.json` + slot scaffold in `App.svelte`.
6. **Agent loop boundary:** Host runs loop; guest never imports host modules — SDK is the only import surface. → Fully specified in [app_builder_agent_loop_architecture.md](./app_builder_agent_loop_architecture.md).
7. **Reuse:** `sandboxStore.write`, `webcontainerProject.ts`, `preview-pane.svelte` toolbar pattern.
8. **Responsive AgentRail:** default 320px open; collapsed 48px icon strip; \<1024px overlay drawer over preview (not push).

---

## Do's and Don'ts

**Do**
- Keep host chrome stable in v1; agent reshapes guest only.
- Show last-write path and HMR latency in HarnessStatus.
- Treat guest `emit` as first-class agent observation (not just console.log).

**Don't**
- Don't require full reboot per agent edit — HMR is the interaction loop.
- Don't let agent edit SDK or host SvelteKit routes in v1.
- Don't fork canonical state into guest — host owns memory; guest is projection + input surface.
