import type { WebContainer } from '@webcontainer/api'
import { normalizeSandboxPath } from '$lib/sandbox/paths'

export interface SandboxDirent {
  name: string
  isDirectory(): boolean
}

/** Minimal filesystem surface shared by WebContainer and the Bun sandbox API. */
export interface SandboxFs {
  readFile(path: string, encoding: 'utf-8'): Promise<string>
  readBinary(path: string): Promise<Uint8Array>
  writeFile(path: string, content: string): Promise<void>
  writeBinary(path: string, content: Uint8Array): Promise<void>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  rename(from: string, to: string): Promise<void>
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>
  readdir(path: string, options: { withFileTypes: true }): Promise<SandboxDirent[]>
  stat(path: string): Promise<{ exists: boolean; isDirectory: boolean }>
}

export interface SandboxPreviewState {
  loading: boolean
  booting: boolean
  error: string
  previewUrl: string
  previewPort: number | null
  phase: string
  logs: string[]
  treeGeneration: number
  restoredFromSnapshot: boolean
  backend: 'bun' | 'webcontainer'
  fsReady: boolean
  templateId: string | null
  expoGoUrl: string
  projectId: string | null
  container?: WebContainer
}

export interface SandboxStore {
  subscribe: (run: (state: SandboxPreviewState) => void) => () => void
  boot: (projectId?: string) => Promise<void>
  bootUserTemplate?: (templateId?: string) => Promise<void>
  saveActiveProject?: (options?: {
    overlay?: boolean
    thumbnail?: boolean
    snapshot?: boolean
  }) => Promise<void>
  flushPendingSnapshot?: () => Promise<void>
  releaseActiveProject?: () => Promise<void>
  switchProject?: (fromId: string | null, toId: string) => Promise<void>
  write: (path: string, content: string) => Promise<void>
  getContainer: () => WebContainer | undefined
  getFs: () => SandboxFs | undefined
  getBackend: () => 'bun' | 'webcontainer' | 'unknown'
  /** Sandbox-scoped session id for server-side terminals (null under WebContainer). */
  getTerminalSessionId: () => string | null
  appendLog: (line: string) => void
  reboot: (options?: { clearSnapshot?: boolean }) => Promise<void>
  clearSnapshot: () => Promise<void>
  notifyFilesystemChange: () => void
}

export function webContainerToFs(container: WebContainer): SandboxFs {
  const path = (p: string) => normalizeSandboxPath(p)
  return {
    readFile: (filePath, encoding) => container.fs.readFile(path(filePath), encoding),
    readBinary: (filePath) => container.fs.readFile(path(filePath)),
    writeFile: (filePath, content) => container.fs.writeFile(path(filePath), content),
    writeBinary: (filePath, content) => container.fs.writeFile(path(filePath), content),
    mkdir: (filePath, options) =>
      options?.recursive
        ? container.fs.mkdir(path(filePath), { recursive: true })
        : container.fs.mkdir(path(filePath)),
    rename: (from, to) => container.fs.rename(path(from), path(to)),
    rm: (filePath, options) => container.fs.rm(path(filePath), options),
    readdir: (filePath, options) => container.fs.readdir(path(filePath), options),
    async stat(filePath) {
      try {
        await container.fs.readFile(path(filePath), 'utf-8')
        return { exists: true, isDirectory: false }
      } catch {
        try {
          await container.fs.readdir(path(filePath))
          return { exists: true, isDirectory: true }
        } catch {
          return { exists: false, isDirectory: false }
        }
      }
    },
  }
}
