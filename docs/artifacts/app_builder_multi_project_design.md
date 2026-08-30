---
version: alpha
name: app-builder-multi-project
description: Design artifact for TRL-154 — local project dashboard, template registry, sequential WebContainer switching
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
  template-svelte: "oklch(0.62 0.19 25)"
  template-vue: "oklch(0.62 0.15 145)"
  template-next: "oklch(0.62 0.02 250)"
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
  dashboardShell:
    backgroundColor: "{colors.background}"
    borderColor: "{colors.border}"
    textColor: "{colors.foreground}"
  projectCard:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.border}"
    textColor: "{colors.card-foreground}"
  templateCard:
    backgroundColor: "{colors.secondary}"
    borderColor: "{colors.border}"
  primaryAction:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  switchOverlay:
    backgroundColor: "oklch(0.145 0 0 / 85%)"
    textColor: "{colors.muted-foreground}"
---

# Design: multi-project dashboard and template registry

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-154 · **Design issue:** TRL-155  
**Mock:** [app_builder_multi_project_mockup.html](./app_builder_multi_project_mockup.html)  
**Source:** greenfield · globals: `src/app.css` · extends harness shell (TRL-151)

---

## Overview

App-builder currently boots a **single implicit project** (`svelte-repl`) with one Dexie snapshot. This wedge adds a **project home** — a dashboard where users see all local projects, create new ones from templates (Svelte, Vue, Next-style), and open each in the existing editor shell.

**Posture:** Dashboard is the **orientation layer** — calm, scannable, local-first. Editor remains the **workbench** (harness + dock unchanged). Switching projects is **sequential** (one WebContainer per tab): leaving a project saves its snapshot; opening another tears down and restores.

**Emotional tone:** Dashboard feels like a project shelf — cards with clear affordances, no cloud chrome. Template picker feels like choosing an instrument, not a wizard. Switch overlay communicates "saving / restoring" without blocking the whole app chrome.

**Non-goals (v1):** Cloud sync, share links, Python/game/notes templates, real Next.js server, Trellis `core:App` registry (Phase 2), concurrent multi-project previews in one tab.

---

## Colors & tokens

Inherit `src/app.css` shadcn dark theme. Feature-specific accents:

| Surface | Token | Usage |
| ------- | ----- | ----- |
| Dashboard canvas | `background` | Full-width grid behind cards |
| Project card | `card`, `border` | Hover ring `ring`; focus `ring` 2px |
| Template badge | `template-svelte`, `template-vue`, `template-next` | Pill on card + picker |
| Empty state | `muted`, `muted-foreground` | "No projects yet" + CTA |
| Switch overlay | semi-opaque `background` | Full workspace during WC teardown/restore |
| Status bar | `status-bar` | Shows active `project.name` (replaces `svelte-repl`) |

---

## Typography

| Copy | Style | Where |
| ---- | ----- | ----- |
| Dashboard title | `text-lg font-semibold` | Page heading — "Projects" |
| Card title | `text-sm font-medium` | Project name (truncate) |
| Card meta | `font-mono text-xs text-muted-foreground` | `2h ago` · template id |
| Template picker heading | `text-base font-medium` | Dialog title |
| Template description | `text-sm text-muted-foreground` | Under template card label |
| Switch status | `font-mono text-xs` | Overlay — "Saving Counter demo…" |

---

## Layout

### Shell anatomy (dashboard route)

```
(app)/+layout.svelte — unchanged chrome
├── IconRail
│   ├── Dashboard (LayoutDashboard) → /dashboard  [NEW — above Editor]
│   ├── Editor → /editor/[id] when project open
│   └── Settings / Plugins (existing)
├── Workspace
│   └── dashboard/+page.svelte  [NEW]
│       ├── PageHeader ("Projects" + New project button)
│       ├── ProjectGrid (responsive auto-fill)
│       │   └── ProjectCard × N
│       └── EmptyState (when N=0)
└── AgentRail (optional — collapsed default on dashboard)
```

### Shell anatomy (editor route — delta only)

```
/editor/[projectId]/+page.svelte
├── AppHeader breadcrumb: Projects (link) › project.name › file segments
├── EditorDock (unchanged)
└── Status bar left: project.name (not svelte-repl)
```

### Project card anatomy

| Zone | Content |
| ---- | ------- |
| Leading | Template icon (Svelte/Vue/React glyph) + colored badge |
| Body | `name` (title), `lastOpenedAt` relative |
| Trailing | `⋯` menu — Open, Rename, Duplicate, Delete |
| Hit target | Whole card opens project; menu button stops propagation |

**Grid:** `repeat(auto-fill, minmax(240px, 1fr))`, gap `16px`, max-width `1200px` centered with `24px` padding.

### New project dialog

| Zone | Content |
| ---- | ------- |
| Header | "New project" |
| Name field | Text input, autofocus, default from template |
| Template grid | 3 cards — Svelte, Vue, Next-style (single-select) |
| Footer | Cancel · Create project (primary, disabled until name + template) |

**Next-style label:** UI copy "Next-style" with subtitle "Vite + React app router layout" — not "Next.js".

### Switch overlay (full workspace)

Shown during `switchProject` / navigate away from editor:

- Semi-opaque scrim over editor workspace only (not icon rail / header)
- Mono status line: phase (`Saving…` → `Restoring…` → `Installing…`)
- `aria-busy="true"` on workspace region
- No cancel in v1 (switch is fast; cancel adds race complexity)

### Responsive

| Breakpoint | Behavior |
| ---------- | -------- |
| ≥1024px | Grid 3–4 columns; dialog centered `max-w-lg` |
| &lt;1024px | Grid 1–2 columns; dialog full-width sheet from bottom optional |
| Icon rail | Always visible under `(app)/` |

---

## Elevation & Depth

- **Project cards:** `border` default; `hover:border-ring`; `focus-visible:ring-2`
- **Template cards in dialog:** selected state = `border-primary` + subtle `bg-accent`
- **Dashboard:** flat — no floating FAB; primary CTA in page header
- **Switch overlay:** `z-20` within workspace; below app header (`z-30`)

---

## Shapes

- Cards: `--radius` (`0.65rem`)
- Template badges: `rounded-full` pills, `text-[10px]` mono uppercase
- Dialog: shadcn `Dialog` / `Sheet` — match existing command palette radius

---

## Components

| Component | Anatomy | States | Maps to codebase |
| --------- | ------- | ------ | ---------------- |
| **DashboardPage** | header + grid + empty | loading, populated, empty | **new** `routes/(app)/dashboard/+page.svelte` |
| **ProjectCard** | icon, title, meta, menu | default, hover, focus, menu-open | **new** `components/project-card.svelte` |
| **NewProjectDialog** | name + template grid + actions | closed, open, submitting | **new** `components/new-project-dialog.svelte` |
| **ProjectGrid** | responsive grid wrapper | — | inline or subcomponent |
| **SwitchOverlay** | scrim + status text | hidden, saving, restoring, installing | **new** `components/project-switch-overlay.svelte` |
| **IconRail** | dashboard link added | active dashboard / editor | `icon-rail.svelte` |
| **AppHeader** | breadcrumb back link | editor with project context | `app-header.svelte`, `setAppHeader` |
| **StatusBar** | project name segment | per active project | `statusBar.svelte.ts` |
| **EditorPage** | dock + sandbox boot by id | booting, ready, error | `editor/[projectId]/+page.svelte` |

---

## Design research

| Ref | Path | Relevant surface |
| --- | ---- | ---------------- |
| Harness shell | `docs/artifacts/app_builder_agent_harness_design.md` | Icon rail, agent rail, header pattern |
| Icon rail | `src/lib/components/icon-rail.svelte` | Single Editor item today — add Dashboard |
| App header | `src/lib/components/app-header.svelte` | Breadcrumb.Link supports `href` |
| WC snapshot | `src/lib/webcontainerSnapshot.ts` | Per-project keying (Architect) |
| Nav projects (unused) | `src/lib/components/nav-projects.svelte` | Dropdown menu pattern reference |
| Plan | `.cursor/plans/multi-project_dashboard_dc5b26d8.plan.md` | Data model, routes, Trellis phases |

---

## Interaction matrix

| Actor | Input | System response | Output / observation |
| ----- | ----- | --------------- | -------------------- |
| Human | Land on `/` | Redirect `/dashboard` | Dashboard or last-project redirect (Architect) |
| Human | Click "New project" | Open dialog | Name field focused; Svelte pre-selected |
| Human | Select template card | Highlight selection | Create enabled when name non-empty |
| Human | Click Create | `createProject` + navigate `/editor/[id]` | WC boots fresh or restores snapshot |
| Human | Click project card | `touchProject` + navigate editor | Switch overlay if another project was open |
| Human | Card menu → Rename | Inline dialog / prompt | Updates `ProjectRecord.name` |
| Human | Card menu → Duplicate | Copy metadata + snapshot bytes | New card appears; opens optional |
| Human | Card menu → Delete | Confirm destructive dialog | Remove Dexie rows; toast |
| Human | Breadcrumb "Projects" | Save snapshot + navigate dashboard | WC teardown; overlay "Saving…" |
| Human | Icon rail Dashboard | Same as breadcrumb | Active state on rail |
| Human | Open Vue/Next project | Editor boots; agent harness | `edit_component` deny + ToolLog `template` |
| Human | Open Svelte project | Full harness | Agent writes unchanged from TRL-150 |
| System | First visit (migration) | `default` snapshot → "My Svelte App" | Single card; no empty state |
| System | Switch project A→B | Flush A snapshot, teardown, restore B | Overlay phases; status bar name updates |
| System | Snapshot save race | Tag in-flight save with `projectId` | Stale save ignored (Architect) |
| System | Empty dashboard | EmptyState + prominent New project | No dummy cards |

---

## Accessibility

**Focus order (dashboard):** IconRail → page "New project" → project cards (DOM order) → AgentRail (if expanded).

**Focus order (editor):** Unchanged from TRL-151; breadcrumb "Projects" is first focusable text link in header column.

**Labels:**
- Dashboard page: `<h1>Projects</h1>` visible or `sr-only` with visible toolbar label
- Project cards: `aria-label="Open {name}, {template} project, last opened {relative}"`
- Card menu: `aria-haspopup="menu"`, `aria-label="Project actions for {name}"`
- New project dialog: `aria-labelledby` on title; template group `role="radiogroup"` with `aria-checked` on cards
- Switch overlay: `role="status"` `aria-live="polite"` for phase text; workspace `aria-busy="true"`

**Motion:** `prefers-reduced-motion` — disable card hover scale; overlay appears instantly without fade.

**Contrast:** Template badge colors meet AA on `card` background; destructive delete uses `destructive` token.

---

## Open for Architect

1. **Routes:** `/dashboard`, `/editor/[projectId]`, redirects from `/` and `/editor`.
2. **ProjectStore interface:** Dexie v1; optional `trellisRepoId` / `trellisEntityId` fields unused until Phase 2.
3. **Snapshot keying:** `webcontainerSnapshot.ts` — `projectId` replaces `'default'`.
4. **switchProject API:** `sandboxStore.boot(projectId)`, teardown on leave, migration from `default` snapshot.
5. **Per-project localStorage:** layout, dock containers, tab names, file tree — suffix `:projectId`.
6. **Template registry:** `svelte` \| `vue` \| `nextjs` static mount trees; entry files differ.
7. **Agent guard:** deny `edit_component` on non-svelte with ToolLog `{ kind: 'deny', reason: 'template' }`.
8. **e2e:** dashboard create Svelte project → open → existing harness tests on `/editor/[id]`.
9. **Trellis deferred:** no `trellis` npm dep in v1; `ProjectStore` adapter boundary only.

---

## Do's and Don'ts

**Do**

- Make Dashboard the default home and the clear "up" from editor (rail + breadcrumb).
- Show template badge on every card so users know harness vs preview-only projects.
- Use switch overlay for sequential WC transitions — never silent teardown.

**Don't**

- Don't imply cloud sync or multi-tab concurrent sandboxes in v1 UI.
- Don't label Next-style template as "Next.js" without qualification.
- Don't block dashboard on WebContainer boot — list projects from Dexie immediately.

---

## Design critique

| ID | Severity | Finding | Resolution |
| -- | -------- | ------- | ---------- |
| C1 | major | Switch overlay could trap focus if modal | Overlay is `role="status"` only — not modal; focus stays on triggering link after navigation |
| C2 | minor | Template colors may clash with status-bar orange | Badges use distinct hues; no overlap with `status-bar` |
| C3 | minor | Empty state needs illustration | Text + CTA sufficient for v1; icon optional |

0 blockers remaining after polish pass.

---

## Design verification

- refs: `docs/artifacts/app_builder_multi_project_design.md`, `docs/artifacts/app_builder_multi_project_mockup.html` (read)
- interaction matrix: 15 rows, 0 empty cells
- a11y: focus order + `prefers-reduced-motion` documented
- token parity: YAML ↔ mock `:root` verified via `verify-app-builder-multi-project-tokens.mjs`
- design.md lint: N/A (optional `@google/design.md` — tokens match harness artifact)
- design critique: 1 round, 0 blockers remaining
