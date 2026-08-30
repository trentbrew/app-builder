import type { Subprocess, Terminal } from 'bun'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { writeReplProject } from './writeReplProject'

const ROOT = resolve(import.meta.dir, '../.sandboxes')
const BASE_PORT = 3100
const MAX_PORT = 3199
const MAX_LOGS = 200

export interface SandboxSession {
  id: string
  dir: string
  phase: string
  port: number | null
  error: string
  logs: string[]
  booting: boolean
  loading: boolean
  devProcess: Subprocess | null
  logListeners: Set<(line: string) => void>
  terminals: Map<string, TerminalHandle>
}

export interface TerminalHandle {
  id: string
  terminal: Terminal
  process: Subprocess | null
  onData: ((data: string) => void) | null
  onExit: (() => void) | null
}

export interface SandboxStatus {
  id: string
  phase: string
  port: number | null
  previewUrl: string
  error: string
  logs: string[]
  booting: boolean
  loading: boolean
}

const sessions = new Map<string, SandboxSession>()
const usedPorts = new Set<number>()

function capLogs(logs: string[], line: string) {
  const next = line.replace(/\r?\n$/, '')
  if (!next) return logs
  const merged = [...logs, next]
  return merged.length > MAX_LOGS ? merged.slice(-MAX_LOGS) : merged
}

function pushLog(session: SandboxSession, line: string) {
  session.logs = capLogs(session.logs, line)
  for (const listener of session.logListeners) listener(line)
}

function allocatePort(): number {
  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (!usedPorts.has(port)) {
      usedPorts.add(port)
      return port
    }
  }
  throw new Error('No preview ports available')
}

function releasePort(port: number | null) {
  if (port !== null) usedPorts.delete(port)
}

function toStatus(session: SandboxSession): SandboxStatus {
  return {
    id: session.id,
    phase: session.phase,
    port: session.port,
    previewUrl: session.port ? `/preview/${session.id}/` : '',
    error: session.error,
    logs: session.logs,
    booting: session.booting,
    loading: session.loading,
  }
}

export function listSessions(): SandboxStatus[] {
  return [...sessions.values()].map(toStatus)
}

export function getSession(id: string): SandboxSession | undefined {
  return sessions.get(id)
}

export function getSessionStatus(id: string): SandboxStatus | undefined {
  const session = sessions.get(id)
  return session ? toStatus(session) : undefined
}

export async function createSession(): Promise<SandboxStatus> {
  await mkdir(ROOT, { recursive: true })

  const id = crypto.randomUUID().slice(0, 8)
  const dir = join(ROOT, id)
  await mkdir(dir, { recursive: true })

  const session: SandboxSession = {
    id,
    dir,
    phase: 'created',
    port: null,
    error: '',
    logs: [],
    booting: false,
    loading: false,
    devProcess: null,
    logListeners: new Set(),
    terminals: new Map(),
  }

  sessions.set(id, session)
  pushLog(session, `Sandbox ${id} created.`)
  return toStatus(session)
}

async function pipeOutput(session: SandboxSession, stream: ReadableStream<Uint8Array>, prefix: string) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) pushLog(session, `[${prefix}] ${line}`)
    }
  }

  if (buffer.trim()) pushLog(session, `[${prefix}] ${buffer}`)
}

async function waitForPort(port: number, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(800) })
      if (res.ok || res.status < 500) return true
    } catch {
      // not ready yet
    }
    await Bun.sleep(250)
  }
  return false
}

export async function bootSession(id: string, appContents: string): Promise<SandboxStatus> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)

  if (session.booting || session.loading) return toStatus(session)
  if (session.port && session.devProcess) return toStatus(session)

  session.booting = true
  session.loading = true
  session.error = ''
  session.phase = 'Mounting project files…'
  pushLog(session, session.phase)

  const port = allocatePort()
  session.port = port

  try {
    await writeReplProject(session.dir, { port, appContents })
    session.phase = 'Installing dependencies…'
    pushLog(session, session.phase)

    const install = Bun.spawn(['bun', 'install'], {
      cwd: session.dir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' },
    })

    const installCode = await install.exited
    void pipeOutput(session, install.stdout!, 'install')
    void pipeOutput(session, install.stderr!, 'install')

    if (installCode !== 0) {
      throw new Error(`bun install failed (exit ${installCode})`)
    }

    pushLog(session, 'Dependencies installed.')
    session.phase = 'Starting dev server…'
    pushLog(session, session.phase)

    const dev = Bun.spawn(['bun', 'run', 'dev'], {
      cwd: session.dir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' },
    })

    session.devProcess = dev
    void pipeOutput(session, dev.stdout!, 'dev')
    void pipeOutput(session, dev.stderr!, 'dev')

    const ready = await waitForPort(port)
    if (!ready) {
      throw new Error(`Dev server did not become ready on port ${port}`)
    }

    session.phase = 'Ready'
    session.booting = false
    session.loading = false
    pushLog(session, `Server ready at http://127.0.0.1:${port}/`)
    return toStatus(session)
  } catch (error) {
    session.error = error instanceof Error ? error.message : 'Boot error'
    session.phase = 'error'
    session.booting = false
    session.loading = false
    pushLog(session, session.error)
    await stopDevProcess(session)
    releasePort(session.port)
    session.port = null
    throw error
  }
}

async function stopDevProcess(session: SandboxSession) {
  if (!session.devProcess) return
  try {
    session.devProcess.kill()
    await session.devProcess.exited
  } catch {
    // process may already be gone
  }
  session.devProcess = null
}

/** PTY shells need interactive + login mode so user dotfiles (aliases, prompts) load. */
function shellInvocationArgs(shellPath: string): string[] {
  const name = shellPath.split('/').pop() ?? ''
  switch (name) {
    case 'bash':
    case 'zsh':
    case 'sh':
      return ['-il']
    case 'fish':
      return ['-l']
    default:
      return ['-l']
  }
}

export function createTerminal(id: string, options: { cols?: number; rows?: number } = {}): TerminalHandle | null {
  const session = sessions.get(id)
  if (!session) return null

  const cols = Math.max(2, Math.min(options.cols ?? 80, 500))
  const rows = Math.max(2, Math.min(options.rows ?? 24, 300))
  const shell = process.env.SHELL || '/bin/bash'

  const handle: TerminalHandle = {
    id: crypto.randomUUID().slice(0, 8),
    terminal: null as unknown as Terminal,
    process: null,
    onData: null,
    onExit: null,
  }

  const decoder = new TextDecoder()
  let proc: Subprocess
  try {
    proc = Bun.spawn([shell, ...shellInvocationArgs(shell)], {
      cwd: session.dir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
      },
      terminal: {
        cols,
        rows,
        data(_terminal, data) {
          handle.onData?.(decoder.decode(data))
        },
      },
    })
  } catch (error) {
    pushLog(session, `Failed to spawn terminal shell: ${error instanceof Error ? error.message : error}`)
    return null
  }

  handle.terminal = proc.terminal!
  handle.process = proc

  void proc.exited
    .catch(() => {})
    .finally(() => {
      session.terminals.delete(handle.id)
      handle.onExit?.()
    })

  session.terminals.set(handle.id, handle)
  pushLog(session, `Terminal ${handle.id} opened (${shell}).`)
  return handle
}

export function getSessionForTerminal(id: string): SandboxSession | undefined {
  return sessions.get(id)
}

async function killTerminal(session: SandboxSession, handle: TerminalHandle) {
  session.terminals.delete(handle.id)
  try {
    handle.process?.kill()
  } catch {}
  try {
    handle.terminal.close()
  } catch {}
}

export async function killAllTerminals(id: string): Promise<void> {
  const session = sessions.get(id)
  if (!session) return
  for (const handle of [...session.terminals.values()]) {
    await killTerminal(session, handle)
  }
}

export async function destroySession(id: string): Promise<void> {
  const session = sessions.get(id)
  if (!session) return

  for (const handle of [...session.terminals.values()]) {
    await killTerminal(session, handle)
  }

  await stopDevProcess(session)
  releasePort(session.port)

  try {
    await rm(session.dir, { recursive: true, force: true })
  } catch {
    // best effort
  }

  sessions.delete(id)
}

export async function rebootSession(id: string, appContents: string): Promise<SandboxStatus> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)

  await stopDevProcess(session)
  releasePort(session.port)
  session.port = null
  session.logs = []
  session.error = ''

  return bootSession(id, appContents)
}

function resolvePath(session: SandboxSession, filePath: string): string {
  const normalized = filePath.startsWith('/') ? filePath.slice(1) : filePath
  const abs = resolve(session.dir, normalized)
  if (!abs.startsWith(session.dir)) {
    throw new Error('Path escapes sandbox')
  }
  return abs
}

export async function readSandboxFile(id: string, filePath: string): Promise<string> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)
  return readFile(resolvePath(session, filePath), 'utf-8')
}

export async function readSandboxFileBinary(id: string, filePath: string): Promise<Uint8Array> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)
  const buffer = await readFile(resolvePath(session, filePath))
  return new Uint8Array(buffer)
}

export async function writeSandboxFile(id: string, filePath: string, content: string): Promise<void> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)
  const abs = resolvePath(session, filePath)
  await mkdir(resolve(abs, '..'), { recursive: true })
  await writeFile(abs, content, 'utf-8')
  pushLog(session, `Wrote ${filePath}`)
}

export async function writeSandboxFileBinary(
  id: string,
  filePath: string,
  content: Uint8Array,
): Promise<void> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)
  const abs = resolvePath(session, filePath)
  await mkdir(resolve(abs, '..'), { recursive: true })
  await writeFile(abs, content)
  pushLog(session, `Wrote ${filePath}`)
}

export async function mkdirSandbox(id: string, dirPath: string, recursive = true): Promise<void> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)
  const abs = resolvePath(session, dirPath)
  await mkdir(abs, { recursive })
  pushLog(session, `Created directory ${dirPath}`)
}

export interface SandboxDirEntry {
  name: string
  isDirectory(): boolean
}

export async function readSandboxDir(id: string, dirPath: string): Promise<SandboxDirEntry[]> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)
  const abs = resolvePath(session, dirPath === '/' ? '.' : dirPath)
  const entries = await readdir(abs, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: () => entry.isDirectory(),
  }))
}

export async function listSandboxTree(
  id: string,
  dirPath: string,
): Promise<Array<{ name: string; path: string; kind: 'file' | 'folder' }>> {
  const session = sessions.get(id)
  if (!session) throw new Error(`Sandbox ${id} not found`)

  const abs = resolvePath(session, dirPath === '/' ? '.' : dirPath)
  const entries = await readdir(abs, { withFileTypes: true })

  return entries.map((entry) => {
    const rel = relative(session.dir, join(abs, entry.name)).replace(/\\/g, '/')
    const path = `/${rel}`
    return {
      name: entry.name,
      path,
      kind: entry.isDirectory() ? ('folder' as const) : ('file' as const),
    }
  })
}

export function subscribeLogs(id: string, listener: (line: string) => void): () => void {
  const session = sessions.get(id)
  if (!session) return () => {}

  session.logListeners.add(listener)
  return () => session.logListeners.delete(listener)
}

export async function proxyPreview(id: string, request: Request): Promise<Response> {
  const session = sessions.get(id)
  if (!session?.port) {
    return new Response('Preview not ready', { status: 503 })
  }

  const url = new URL(request.url)
  const suffix = url.pathname.replace(`/preview/${id}`, '') || '/'
  const target = `http://127.0.0.1:${session.port}${suffix}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete('host')

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })
}

export async function cleanupAll() {
  for (const id of [...sessions.keys()]) {
    await destroySession(id)
  }
}

process.on('SIGINT', () => {
  void cleanupAll().finally(() => process.exit(0))
})

process.on('SIGTERM', () => {
  void cleanupAll().finally(() => process.exit(0))
})
