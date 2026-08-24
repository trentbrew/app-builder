# App Builder — local dev orchestration

port := env_var_or_default('PORT', '9898')
host := env_var_or_default('HOST', 'localhost')
url := 'http://' + host + ':' + port

default:
    @just --list

# Install dependencies
install:
    pnpm install

# Stop whatever is listening on the dev port
stop:
    #!/usr/bin/env bash
    set -euo pipefail
    pids=$(lsof -ti :{{port}} 2>/dev/null || true)
    if [ -z "$pids" ]; then
      echo "Nothing listening on :{{port}}"
    else
      echo "Stopping :{{port}} (pid $pids)"
      kill $pids 2>/dev/null || true
    fi

# Start all development services concurrently
run:
    #!/usr/bin/env bash
    set -euo pipefail
    if lsof -ti :{{port}} >/dev/null 2>&1; then
      echo "→ Already running at {{url}}/editor"
      exit 0
    fi
    trap 'kill 0' EXIT INT TERM
    echo "→ {{url}}/editor"
    pnpm run dev &
    wait

# Restart dev server (stop + run)
restart: stop run

# SvelteKit + Vite dev server (COEP/COOP for WebContainer in vite.config.js)
dev:
    @echo "→ {{url}}/editor"
    pnpm run dev

# Production build
build:
    pnpm run build

# Preview production build
preview:
    pnpm run preview -- --port {{port}} --strictPort
