import { browser } from '$app/environment'
import { writable } from 'svelte/store'
import { initialCode } from '$lib/initialCode'
import type { SandboxFs, SandboxPreviewState } from '$lib/sandbox/types'

const BOOT_TIMEOUT_MS = 120_000
const MAX_LOGS = 200
const STORE_KEY = '__appBuilderBunStore__'
const SESSION_STORAGE_KEY = 'app-builder:bun-session-id'

type BunSandboxStore = ReturnType<typeof createBunSandboxStore>

declare global {
  interface Window {
    [STORE_KEY]?: BunSandboxStore
  }
}

function capLogs(logs: string[], line: string) {
  const next = line.replace(/\r?\n$/, '')
  if (!next) return logs
  const merged = [...logs, next]
  return merged.length > MAX_LOGS ? merged.slice(-MAX_LOGS) : merged
}

function createBunFs(sessionId: string): SandboxFs {
  const api = (path: string) => `/api/sandbox/${sessionId}${path}`

  return {
    async readFile(path, _encoding) {
      const filePath = path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api(`/files?path=${encodeURIComponent(filePath)}`))
      if (!res.ok) throw new Error(`Failed to read ${filePath}`)
      const data = (await res.json()) as { content: string }
      return data.content
    },
    async readBinary(path) {
      const filePath = path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api(`/files/raw?path=${encodeURIComponent(filePath)}`))
      if (!res.ok) throw new Error(`Failed to read ${filePath}`)
      return new Uint8Array(await res.arrayBuffer())
    },
    async writeFile(path, content) {
      const filePath = path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api('/files'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      })
      if (!res.ok) throw new Error(`Failed to write ${filePath}`)
    },
    async writeBinary(path, content) {
      const filePath = path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api(`/files/raw?path=${encodeURIComponent(filePath)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: content,
      })
      if (!res.ok) throw new Error(`Failed to write ${filePath}`)
    },
    async mkdir(path, options) {
      const dirPath = path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api('/files/mkdir'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath, recursive: options?.recursive ?? true }),
      })
      if (!res.ok) throw new Error(`Failed to create directory ${dirPath}`)
    },
    async rename(from, to) {
      const fromPath = from.startsWith('/') ? from : `/${from}`
      const toPath = to.startsWith('/') ? to : `/${to}`
      const res = await fetch(api('/files/rename'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromPath, to: toPath }),
      })
      if (!res.ok) throw new Error(`Failed to rename ${fromPath}`)
    },
    async rm(path, options) {
      const filePath = path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api('/files/rm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          recursive: options?.recursive ?? false,
          force: options?.force ?? false,
        }),
      })
      if (!res.ok) throw new Error(`Failed to delete ${filePath}`)
    },
    async readdir(path, _options) {
      const dirPath = path === '' ? '/' : path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api(`/files?path=${encodeURIComponent(dirPath)}`))
      if (!res.ok) throw new Error(`Failed to read directory ${dirPath}`)
      const data = (await res.json()) as {
        entries: Array<{ name: string; isDirectory: boolean }>
      }
      return data.entries.map((entry) => ({
        name: entry.name,
        isDirectory: () => entry.isDirectory,
      }))
    },
    async stat(path) {
      const filePath = path === '' ? '/' : path.startsWith('/') ? path : `/${path}`
      const res = await fetch(api(`/files/stat?path=${encodeURIComponent(filePath)}`))
      if (!res.ok) return { exists: false, isDirectory: false }
      return (await res.json()) as { exists: boolean; isDirectory: boolean }
    },
  }
}

function createBunSandboxStore() {
  let sessionId: string | null = null
  let fs: SandboxFs | undefined
  let logSource: EventSource | null = null

  const { subscribe, set, update } = writable<SandboxPreviewState>({
    loading: false,
    booting: false,
    error: '',
    previewUrl: '',
    previewPort: null,
    phase: 'idle',
    logs: [],
    treeGeneration: 0,
    restoredFromSnapshot: false,
    backend: 'bun',
    fsReady: false,
    templateId: null,
    expoGoUrl: '',
    projectId: null,
  })

  function pushLog(line: string) {
    update((s) => ({ ...s, logs: capLogs(s.logs, line) }))
  }

  function setPhase(phase: string) {
    update((s) => ({ ...s, phase }))
    pushLog(phase)
  }

  function bumpTreeGeneration() {
    update((s) => ({ ...s, treeGeneration: s.treeGeneration + 1 }))
  }

  function connectLogs(id: string) {
    logSource?.close()
    logSource = new EventSource(`/api/sandbox/${id}/logs`)
    logSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { line?: string }
        if (data.line) pushLog(data.line)
      } catch {
        // ignore malformed events
      }
    }
  }

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId

    const cachedId = browser ? sessionStorage.getItem(SESSION_STORAGE_KEY) : null
    if (cachedId) {
      try {
        const res = await fetch(`/api/sandbox/${cachedId}`)
        if (res.ok) {
          const status = (await res.json()) as {
            id: string
            previewUrl?: string
            port?: number | null
            phase?: string
          }
          sessionId = status.id
          fs = createBunFs(sessionId)
          connectLogs(sessionId)
          update((s) => ({
            ...s,
            previewUrl: status.previewUrl ?? `/preview/${sessionId}/`,
            previewPort: status.port ?? null,
            phase: status.phase ?? 'Ready',
            fsReady: true,
            loading: false,
            booting: false,
            error: '',
          }))
          bumpTreeGeneration()
          pushLog(`Restored Bun sandbox session ${sessionId}.`)
          return sessionId
        }
      } catch {
        // fall through to create a new session
      }
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }

    const res = await fetch('/api/sandbox', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to create sandbox session')
    const data = (await res.json()) as { id: string }
    sessionId = data.id
    if (browser) sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    fs = createBunFs(sessionId)
    connectLogs(sessionId)
    return sessionId
  }

  async function doInit() {
    if (!browser) return

    update((s) => ({
      ...s,
      booting: true,
      loading: true,
      error: '',
      previewUrl: '',
      previewPort: null,
      phase: 'starting',
      logs: capLogs(s.logs, 'Starting Bun sandbox…'),
      backend: 'bun',
    }))

    const timeout = setTimeout(() => {
      update((s) => ({
        ...s,
        booting: false,
        loading: false,
        error: s.error || 'Boot timed out. Is the sandbox server running?',
      }))
    }, BOOT_TIMEOUT_MS)

    try {
      const id = await ensureSession()

      let current: SandboxPreviewState | undefined
      subscribe((s) => (current = s))()
      if (current?.fsReady && current.previewUrl) {
        clearTimeout(timeout)
        return
      }

      setPhase('Booting Bun sandbox…')

      const bootRes = await fetch(`/api/sandbox/${id}/boot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appContents: initialCode }),
      })

      const bootData = (await bootRes.json()) as {
        error?: string
        previewUrl?: string
        port?: number | null
        phase?: string
      }

      clearTimeout(timeout)

      if (!bootRes.ok) {
        throw new Error(bootData.error ?? 'Boot failed')
      }

      update((s) => ({
        ...s,
        loading: false,
        booting: false,
        error: '',
        previewUrl: bootData.previewUrl ?? `/preview/${id}/`,
        previewPort: bootData.port ?? null,
        phase: bootData.phase ?? 'Ready',
        fsReady: true,
        restoredFromSnapshot: false,
      }))
      bumpTreeGeneration()
    } catch (error) {
      clearTimeout(timeout)
      const message = error instanceof Error ? error.message : 'Boot error'
      set({
        loading: false,
        booting: false,
        error: message,
        previewUrl: '',
        previewPort: null,
        phase: 'error',
        logs: capLogs([], message),
        treeGeneration: 0,
        restoredFromSnapshot: false,
        backend: 'bun',
        fsReady: false,
      })
    }
  }

  let bootPromise: Promise<void> | undefined

  function boot() {
    if (!browser) return Promise.resolve()
    if (bootPromise) return bootPromise

    let snapshot: SandboxPreviewState | undefined
    subscribe((s) => (snapshot = s))()
    if (snapshot?.booting || snapshot?.previewUrl) return bootPromise ?? Promise.resolve()

    bootPromise = doInit().finally(() => {
      bootPromise = undefined
    })
    return bootPromise
  }

  return {
    subscribe,
    appendLog: pushLog,
    boot,
    getSessionId: () => sessionId,
    write: async (path: string, content: string) => {
      await boot()
      if (!sessionId || !fs) return
      const filePath = path.startsWith('/') ? path : `/${path}`
      await fs.writeFile(filePath, content)
      bumpTreeGeneration()
    },
    getContainer: () => undefined,
    getFs: () => fs,
    getBackend: () => 'bun' as const,
    notifyFilesystemChange: () => bumpTreeGeneration(),
    clearSnapshot: async () => {},
    reboot: async () => {
      if (browser) sessionStorage.removeItem(SESSION_STORAGE_KEY)

      if (!browser || !sessionId) {
        location.reload()
        return
      }

      update((s) => ({
        ...s,
        booting: true,
        loading: true,
        error: '',
        previewUrl: '',
        previewPort: null,
        phase: 'Rebooting…',
      }))

      try {
        const res = await fetch(`/api/sandbox/${sessionId}/reboot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appContents: initialCode }),
        })
        const data = (await res.json()) as {
          error?: string
          previewUrl?: string
          port?: number | null
          phase?: string
        }
        if (!res.ok) throw new Error(data.error ?? 'Reboot failed')

        update((s) => ({
          ...s,
          booting: false,
          loading: false,
          error: '',
          previewUrl: data.previewUrl ?? `/preview/${sessionId}/`,
          previewPort: data.port ?? null,
          phase: data.phase ?? 'Ready',
          fsReady: true,
        }))
        bumpTreeGeneration()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Reboot failed'
        update((s) => ({
          ...s,
          booting: false,
          loading: false,
          error: message,
          phase: 'error',
        }))
      }
    },
  }
}

function getStore() {
  if (browser && window[STORE_KEY]) return window[STORE_KEY]!
  const store = createBunSandboxStore()
  if (browser) window[STORE_KEY] = store
  return store
}

export const bunSandboxStore = getStore()
