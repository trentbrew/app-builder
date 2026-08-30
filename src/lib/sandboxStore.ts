import { browser } from '$app/environment'
import { bunSandboxStore } from '$lib/bunSandboxStore'
import type { SandboxStore } from '$lib/sandbox/types'
import { webContainerToFs } from '$lib/sandbox/types'
import { webcontainerStore } from '$lib/webcontainerStore'

export type SandboxBackend = 'bun' | 'webcontainer'

let resolvedBackend: SandboxBackend | null = null
let resolvePromise: Promise<SandboxBackend> | null = null

/** Called from `(app)/+layout.server.ts` so the client never needs a health probe fetch. */
export function initSandboxBackend(backend: SandboxBackend) {
  if (resolvedBackend) return
  resolvedBackend = backend
  resolvePromise = Promise.resolve(backend)
}

async function detectBackend(): Promise<SandboxBackend> {
  if (resolvedBackend) return resolvedBackend
  if (!browser) return 'webcontainer'

  const forced = import.meta.env.PUBLIC_SANDBOX_BACKEND
  if (forced === 'bun' || forced === 'webcontainer') return forced

  // Fallback when layout server data was not initialized (e.g. tests).
  try {
    const res = await fetch('/sandbox-health', { signal: AbortSignal.timeout(800) })
    if (!res.ok) return 'webcontainer'
    const data = (await res.json()) as { ok?: boolean }
    if (data.ok) return 'bun'
  } catch {
    // Bun server not running — fall back to in-browser WebContainer
  }

  return 'webcontainer'
}

async function getBackend(): Promise<SandboxBackend> {
  if (resolvedBackend) return resolvedBackend
  if (!resolvePromise) {
    resolvePromise = detectBackend().then((backend) => {
      resolvedBackend = backend
      return backend
    })
  }
  return resolvePromise
}

function wrapWebContainerStore(): SandboxStore {
  return {
    subscribe: (run) =>
      webcontainerStore.subscribe((state) =>
        run({
          ...state,
          backend: 'webcontainer',
          fsReady: Boolean(state.fs),
        }),
      ),
    boot: (projectId) => webcontainerStore.boot(projectId),
    bootUserTemplate: (templateId) => webcontainerStore.bootUserTemplate(templateId),
    saveActiveProject: (options) => webcontainerStore.saveActiveProject(options),
    flushPendingSnapshot: () => webcontainerStore.flushPendingSnapshot(),
    releaseActiveProject: () => webcontainerStore.releaseActiveProject(),
    switchProject: (fromId, toId) => webcontainerStore.switchProject(fromId, toId),
    write: (path, content) => webcontainerStore.write(path, content),
    getContainer: () => webcontainerStore.getContainer(),
    getFs: () => {
      const container = webcontainerStore.getContainer()
      return container ? webContainerToFs(container) : undefined
    },
    getBackend: () => 'webcontainer',
    getTerminalSessionId: () => null,
    appendLog: (line) => webcontainerStore.appendLog(line),
    reboot: (options) => webcontainerStore.reboot(options),
    clearSnapshot: () => webcontainerStore.clearSnapshot(),
    notifyFilesystemChange: () => webcontainerStore.notifyFilesystemChange(),
  }
}

function wrapBunStore(): SandboxStore {
  return {
    subscribe: (run) => bunSandboxStore.subscribe(run),
    boot: (_projectId) => bunSandboxStore.boot(),
    saveActiveProject: async () => {},
    flushPendingSnapshot: async () => {},
    releaseActiveProject: async () => {},
    switchProject: async (_fromId, _toId) => {},
    write: (path, content) => bunSandboxStore.write(path, content),
    getContainer: () => undefined,
    getFs: () => bunSandboxStore.getFs(),
    getBackend: () => 'bun',
    getTerminalSessionId: () => bunSandboxStore.getSessionId(),
    appendLog: (line) => bunSandboxStore.appendLog(line),
    reboot: () => bunSandboxStore.reboot(),
    clearSnapshot: () => bunSandboxStore.clearSnapshot(),
    notifyFilesystemChange: () => bunSandboxStore.notifyFilesystemChange(),
  }
}

let activeStore: SandboxStore | null = null

async function ensureStore(): Promise<SandboxStore> {
  if (activeStore) return activeStore
  const backend = await getBackend()
  activeStore = backend === 'bun' ? wrapBunStore() : wrapWebContainerStore()
  return activeStore
}

/** Unified sandbox facade — prefers the Bun server when available, otherwise WebContainer. */
export const sandboxStore: SandboxStore = {
  subscribe(run) {
    let innerUnsub: (() => void) | undefined
    let cancelled = false

    void ensureStore().then((store) => {
      if (cancelled) return
      innerUnsub = store.subscribe(run)
    })

    return () => {
      cancelled = true
      innerUnsub?.()
    }
  },
  async boot(projectId?: string) {
    return (await ensureStore()).boot(projectId)
  },
  async bootUserTemplate(templateId?: string) {
    const store = await ensureStore()
    if (store.bootUserTemplate) return store.bootUserTemplate(templateId)
  },
  async saveActiveProject(options?: { overlay?: boolean; thumbnail?: boolean; snapshot?: boolean }) {
    return (await ensureStore()).saveActiveProject?.(options)
  },
  async flushPendingSnapshot() {
    return (await ensureStore()).flushPendingSnapshot?.()
  },
  async releaseActiveProject() {
    return (await ensureStore()).releaseActiveProject?.()
  },
  async switchProject(fromId: string | null, toId: string) {
    return (await ensureStore()).switchProject?.(fromId, toId)
  },
  async write(path, content) {
    return (await ensureStore()).write(path, content)
  },
  getContainer() {
    return activeStore?.getContainer()
  },
  getFs() {
    return activeStore?.getFs()
  },
  getBackend() {
    return resolvedBackend ?? 'unknown'
  },
  getTerminalSessionId() {
    return activeStore?.getTerminalSessionId() ?? null
  },
  appendLog(line) {
    activeStore?.appendLog(line)
  },
  async reboot(options) {
    return (await ensureStore()).reboot(options)
  },
  async clearSnapshot() {
    return (await ensureStore()).clearSnapshot()
  },
  notifyFilesystemChange() {
    activeStore?.notifyFilesystemChange()
  },
}

/** @deprecated Use sandboxStore — kept for gradual migration. */
export { sandboxStore as webcontainerStoreCompat }
