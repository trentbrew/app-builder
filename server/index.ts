import {
  bootSession,
  createSession,
  createTerminal,
  destroySession,
  getSessionForTerminal,
  getSessionStatus,
  listSessions,
  proxyPreview,
  readSandboxDir,
  readSandboxFile,
  readSandboxFileBinary,
  sandboxStat,
  rebootSession,
  subscribeLogs,
  writeSandboxFile,
  writeSandboxFileBinary,
  mkdirSandbox,
  renameSandbox,
  rmSandbox,
  execSandbox,
} from './sandboxManager'
import { mimeFromPath } from './mime'

const PORT = Number(process.env.SANDBOX_SERVER_PORT ?? 9899)

interface TerminalWsData {
  sessionId: string
  terminalId?: string
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function badRequest(message: string) {
  return json({ error: message }, 400)
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(request, bunServer) {
    const url = new URL(request.url)
    const { pathname } = url

    const terminalMatch = pathname.match(/^\/api\/sandbox\/([^/]+)\/terminal$/)
    if (
      terminalMatch &&
      bunServer.upgrade<TerminalWsData>(request, {
        data: { sessionId: terminalMatch[1]! },
      })
    ) {
      return undefined
    }

    if (pathname === '/health') {
      return json({ ok: true, runtime: 'bun', version: Bun.version, sandboxes: listSessions().length })
    }

    if (pathname === '/api/sandbox/health') {
      return json({ ok: true, backend: 'bun', sandboxes: listSessions().length })
    }

    if (pathname === '/api/sandbox' && request.method === 'GET') {
      return json({ sandboxes: listSessions() })
    }

    if (pathname === '/api/sandbox' && request.method === 'POST') {
      const session = await createSession()
      return json(session, 201)
    }

    const sandboxMatch = pathname.match(/^\/api\/sandbox\/([^/]+)(?:\/(.*))?$/)
    if (sandboxMatch) {
      const id = sandboxMatch[1]!
      const rest = sandboxMatch[2] ?? ''

      if (rest === '' && request.method === 'GET') {
        const status = getSessionStatus(id)
        return status ? json(status) : json({ error: 'Not found' }, 404)
      }

      if (rest === '' && request.method === 'DELETE') {
        await destroySession(id)
        return json({ ok: true })
      }

      if (rest === 'boot' && request.method === 'POST') {
        const body = await readJson<{ appContents?: string }>(request)
        if (!body?.appContents) return badRequest('appContents is required')
        try {
          const status = await bootSession(id, body.appContents)
          return json(status)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Boot failed'
          return json({ error: message, ...(getSessionStatus(id) ?? {}) }, 500)
        }
      }

      if (rest === 'reboot' && request.method === 'POST') {
        const body = await readJson<{ appContents?: string }>(request)
        if (!body?.appContents) return badRequest('appContents is required')
        try {
          const status = await rebootSession(id, body.appContents)
          return json(status)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Reboot failed'
          return json({ error: message, ...(getSessionStatus(id) ?? {}) }, 500)
        }
      }

      if (rest === 'files/raw' && request.method === 'GET') {
        const filePath = url.searchParams.get('path')
        if (!filePath) return badRequest('path is required')
        try {
          const bytes = await readSandboxFileBinary(id, filePath)
          return new Response(bytes, {
            headers: {
              'Content-Type': mimeFromPath(filePath),
              'Content-Length': String(bytes.byteLength),
              'Cross-Origin-Resource-Policy': 'same-origin',
              'Cache-Control': 'no-store',
            },
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Read failed'
          return json({ error: message }, 404)
        }
      }

      if (rest === 'files/raw' && request.method === 'PUT') {
        const filePath = url.searchParams.get('path')
        if (!filePath) return badRequest('path is required')
        try {
          const bytes = new Uint8Array(await request.arrayBuffer())
          await writeSandboxFileBinary(id, filePath, bytes)
          return json({ ok: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Write failed'
          return json({ error: message }, 400)
        }
      }

      if (rest === 'files/stat' && request.method === 'GET') {
        const filePath = url.searchParams.get('path') ?? '/'
        try {
          const info = await sandboxStat(id, filePath)
          return json({ exists: true, isDirectory: info.isDirectory() })
        } catch {
          return json({ exists: false, isDirectory: false })
        }
      }

      if (rest === 'files' && request.method === 'GET') {
        const filePath = url.searchParams.get('path') ?? '/'
        try {
          const info = await sandboxStat(id, filePath)
          if (info.isDirectory()) {
            const entries = await readSandboxDir(id, filePath)
            return json({
              entries: entries.map((entry) => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
              })),
            })
          }
          const content = await readSandboxFile(id, filePath)
          return json({ path: filePath, content })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Read failed'
          return json({ error: message }, 404)
        }
      }

      if (rest === 'files' && request.method === 'PUT') {
        const body = await readJson<{ path?: string; content?: string }>(request)
        if (!body?.path || body.content === undefined) {
          return badRequest('path and content are required')
        }
        try {
          await writeSandboxFile(id, body.path, body.content)
          return json({ ok: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Write failed'
          return json({ error: message }, 400)
        }
      }

      if (rest === 'files/mkdir' && request.method === 'POST') {
        const body = await readJson<{ path?: string; recursive?: boolean }>(request)
        if (!body?.path) return badRequest('path is required')
        try {
          await mkdirSandbox(id, body.path, body.recursive ?? true)
          return json({ ok: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Mkdir failed'
          return json({ error: message }, 400)
        }
      }

      if (rest === 'files/rename' && request.method === 'POST') {
        const body = await readJson<{ from?: string; to?: string }>(request)
        if (!body?.from || !body?.to) return badRequest('from and to are required')
        try {
          await renameSandbox(id, body.from, body.to)
          return json({ ok: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Rename failed'
          return json({ error: message }, 400)
        }
      }

      if (rest === 'files/rm' && request.method === 'POST') {
        const body = await readJson<{ path?: string; recursive?: boolean; force?: boolean }>(request)
        if (!body?.path) return badRequest('path is required')
        try {
          await rmSandbox(id, body.path, { recursive: body.recursive, force: body.force })
          return json({ ok: true })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Delete failed'
          return json({ error: message }, 400)
        }
      }

      if (rest === 'exec' && request.method === 'POST') {
        const body = await readJson<{ command?: string; args?: string[]; timeoutMs?: number }>(request)
        if (!body?.command) return badRequest('command is required')
        try {
          const result = await execSandbox(id, body.command, body.args ?? [], body.timeoutMs ?? 60_000)
          return json(result)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Exec failed'
          return json({ error: message }, 500)
        }
      }

      if (rest === 'logs' && request.method === 'GET') {
        const status = getSessionStatus(id)
        if (!status) return json({ error: 'Not found' }, 404)

        const stream = new ReadableStream<string>({
          start(controller) {
            for (const line of status.logs) {
              controller.enqueue(`data: ${JSON.stringify({ line })}\n\n`)
            }
            const unsubscribe = subscribeLogs(id, (line) => {
              controller.enqueue(`data: ${JSON.stringify({ line })}\n\n`)
            })
            request.signal.addEventListener('abort', () => {
              unsubscribe()
              controller.close()
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      }
    }

    const previewMatch = pathname.match(/^\/preview\/([^/]+)(\/.*)?$/)
    if (previewMatch) {
      const id = previewMatch[1]!
      return proxyPreview(id, request)
    }

    return json({ error: 'Not found' }, 404)
  },
  websocket: {
    open(ws) {
      const { sessionId } = ws.data as TerminalWsData
      const session = getSessionForTerminal(sessionId)
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: `Sandbox ${sessionId} not found` }))
        ws.close(1008, 'Sandbox not found')
        return
      }

      const handle = createTerminal(sessionId, {})
      if (!handle) {
        ws.close(1011, 'Failed to spawn terminal')
        return
      }

      ws.data.terminalId = handle.id
      const encoder = new TextEncoder()
      handle.onData = (data) => {
        if (ws.readyState === 1) ws.send(encoder.encode(data))
      }
      handle.onExit = () => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'exit' }))
          ws.close(1000, 'Shell exited')
        }
      }
    },
    message(ws, message) {
      const handleId = (ws.data as TerminalWsData).terminalId
      const session = getSessionForTerminal((ws.data as TerminalWsData).sessionId)
      if (!handleId || !session) return
      const handle = session.terminals.get(handleId)
      if (!handle) return

      if (typeof message !== 'string') return
      try {
        const msg = JSON.parse(message) as
          | { type: 'input'; data: string }
          | { type: 'resize'; cols: number; rows: number }
        if (msg.type === 'input') {
          handle.terminal.write(msg.data)
        } else if (msg.type === 'resize') {
          handle.terminal.resize(Math.max(2, Math.min(msg.cols | 0, 500)), Math.max(2, Math.min(msg.rows | 0, 300)))
        }
      } catch {
        // ignore malformed frames
      }
    },
    close(ws) {
      const { sessionId, terminalId } = ws.data as TerminalWsData
      if (!terminalId) return
      const session = getSessionForTerminal(sessionId)
      const handle = session?.terminals.get(terminalId)
      if (!session || !handle) return

      session.terminals.delete(terminalId)
      try {
        handle.process?.kill()
      } catch {}
      try {
        handle.terminal.close()
      } catch {}
    },
  },
})

console.log(`[sandbox-server] listening on http://localhost:${server.port}`)
