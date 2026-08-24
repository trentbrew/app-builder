# App Builder

Browser-based Svelte REPL with a docked editor, live preview, file explorer, and integrated terminal.

## Architecture

| Layer | Role |
| ----- | ---- |
| **SvelteKit UI** (port 9898) | Editor shell, CodeMirror, preview iframe, layout |
| **Bun sandbox server** (port 9899) | Local REPL runtime — `bun install`, Vite dev server, preview proxy |
| **WebContainer** (fallback) | In-browser Node sandbox when the Bun server isn't running |

When both are available, the client **auto-detects** the Bun server and uses it (much faster installs). Set `PUBLIC_SANDBOX_BACKEND=webcontainer` to force in-browser mode.

## Developing

Install dependencies (pnpm or bun):

```bash
pnpm install
# or: bun install
```

### Recommended — UI + Bun sandbox together

```bash
bun run dev:all
```

This runs:
- Vite/SvelteKit on **http://localhost:9898**
- Bun sandbox API on **http://localhost:9899** (proxied via Vite at `/api/sandbox` and `/preview`)

### UI only (WebContainer fallback)

```bash
pnpm dev
```

Without the sandbox server, preview boots inside WebContainer (~30–60s first install).

### Sandbox server only

```bash
bun run dev:sandbox
```

## Environment

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `SANDBOX_SERVER_PORT` | `9899` | Bun sandbox listen port |
| `SANDBOX_SERVER_URL` | `http://localhost:9899` | Vite dev proxy target |
| `PUBLIC_SANDBOX_BACKEND` | auto | `bun` or `webcontainer` to force a backend |

## Sandbox API

```
GET  /health
GET  /api/sandbox/health
POST /api/sandbox                         → create session
GET  /api/sandbox/:id                     → status
POST /api/sandbox/:id/boot                → { appContents }
POST /api/sandbox/:id/reboot              → { appContents }
PUT  /api/sandbox/:id/files               → { path, content }
GET  /api/sandbox/:id/files?path=/App.svelte
GET  /api/sandbox/:id/logs                → SSE
GET  /preview/:id/*                       → proxy to Vite preview
```

Workspaces are stored in `.sandboxes/` (gitignored).

## Build

```bash
pnpm build
pnpm preview
```

Deploys to Vercel via `@sveltejs/adapter-vercel`. The Bun sandbox server is **local-dev only** for now; production still uses WebContainer unless you deploy the server separately.
