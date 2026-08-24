<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { sandboxStore } from '$lib/sandboxStore'

  let {
    sessionId = 'default',
    attachPreviewMessages = false,
  }: {
    sessionId?: string
    attachPreviewMessages?: boolean
  } = $props()

  let terminalContainer: HTMLDivElement | null = null
  let xterm: any | null = null
  let process: any
  let unsubscribe: () => void
  let writer: any
  let fitAddon: any
  let resizeObserver: ResizeObserver | null = null
  let fitRafId: number | null = null
  let userScrolledUp = false
  let spawning = false
  let attachedContainer: unknown = null
  let bunSocket: WebSocket | null = null
  let bunConnecting = false
  let bunInputQueue: string[] = []
  let bunConnectAttempts = 0

  function sendBunInput(data: string) {
    if (bunSocket && bunSocket.readyState === WebSocket.OPEN) {
      bunSocket.send(JSON.stringify({ type: 'input', data }))
    } else if (bunInputQueue.length < 1000) {
      bunInputQueue.push(data)
    }
  }

  function sendBunResize() {
    if (bunSocket && bunSocket.readyState === WebSocket.OPEN && xterm) {
      bunSocket.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }))
    }
  }

  function connectBunTerminal() {
    if (bunSocket || bunConnecting || !xterm) return
    const sessionId = sandboxStore.getTerminalSessionId()
    if (!sessionId) {
      if (bunConnectAttempts < 30) {
        bunConnectAttempts++
        setTimeout(() => {
          if (!bunSocket && !bunConnecting) connectBunTerminal()
        }, 1000)
      }
      return
    }
    bunConnectAttempts = 0

    bunConnecting = true
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${proto}//${location.host}/api/sandbox/${sessionId}/terminal`)
    socket.binaryType = 'arraybuffer'
    const decoder = new TextDecoder()

    socket.onopen = () => {
      bunSocket = socket
      bunConnecting = false
      sendBunResize()
      for (const chunk of bunInputQueue) sendBunInput(chunk)
      bunInputQueue = []
    }

    socket.onmessage = (event) => {
      if (!xterm) return
      // Text frames are control messages; PTY output arrives as binary frames.
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data) as { type?: string; message?: string }
          if (msg.type === 'exit') {
            xterm.writeln('\r\n\x1b[90mShell exited.\x1b[0m')
          } else if (msg.type === 'error') {
            xterm.writeln(`\r\n\x1b[31m${msg.message ?? 'Terminal error'}\x1b[0m`)
          }
        } catch {
          // ignore malformed control frames
        }
        return
      }
      const bytes = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : event.data
      xterm.write(decoder.decode(bytes, { stream: true }))
      scrollToBottom()
    }

    socket.onclose = () => {
      bunSocket = null
      bunConnecting = false
      process = undefined
      xterm?.writeln('\r\n\x1b[90mServer terminal closed.\x1b[0m')
    }

    socket.onerror = () => {
      bunConnecting = false
    }
  }

  function isAbortedError(error: unknown) {
    return error instanceof Error && /aborted|Process aborted/i.test(error.message)
  }

  function isTerminalReadyForFit(): boolean {
    if (!xterm || !fitAddon || !terminalContainer) return false
    if (!terminalContainer.isConnected || terminalContainer.offsetWidth <= 0 || terminalContainer.offsetHeight <= 0) {
      return false
    }
    if (!xterm.element?.isConnected || !xterm.element.parentElement) return false

    const core = xterm._core
    const dims = core?._renderService?.dimensions
    if (!dims?.css?.cell?.width || !dims?.css?.cell?.height) return false
    if (xterm.options.scrollback !== 0 && !core?.viewport) return false

    return true
  }

  function scrollToBottom(force = false) {
    if (!xterm) return
    if (!force && userScrolledUp) return
    xterm.scrollToBottom()
    userScrolledUp = false
  }

  function safeFit(retries = 8) {
    if (!isTerminalReadyForFit()) {
      if (retries > 0) {
        fitRafId = requestAnimationFrame(() => safeFit(retries - 1))
      }
      return
    }
    try {
      fitAddon.fit()
      scrollToBottom(true)
      sendBunResize()
    } catch (e) {
      if (retries > 0) {
        fitRafId = requestAnimationFrame(() => safeFit(retries - 1))
      } else {
        console.warn('fitAddon.fit() failed:', e)
      }
    }
  }

  function scheduleFit() {
    if (fitRafId !== null) cancelAnimationFrame(fitRafId)
    fitRafId = requestAnimationFrame(() => safeFit())
  }

  onMount(() => {
    if (!browser) return
    ;(async () => {
      try {
        const { Terminal } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        await import('@xterm/xterm/css/xterm.css')

        if (typeof Terminal !== 'function') {
          console.error('Failed to import @xterm/xterm: Terminal is not a function/constructor.', Terminal)
          return
        }

        const surface = document.createElement('div')
        surface.className = 'bg-background'
        surface.style.position = 'absolute'
        surface.style.visibility = 'hidden'
        document.body.appendChild(surface)
        const terminalBackground = getComputedStyle(surface).backgroundColor
        surface.remove()

        xterm = new Terminal({
          convertEol: true,
          cursorBlink: true,
          scrollback: 10000,
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          theme: {
            background: terminalBackground,
          },
        })
        fitAddon = new FitAddon()
        xterm.loadAddon(fitAddon)

        if (terminalContainer) {
          xterm.open(terminalContainer)
          scheduleFit()

          resizeObserver = new ResizeObserver(() => {
            scheduleFit()
          })
          resizeObserver.observe(terminalContainer)
        } else {
          console.error('Terminal container is not available for xterm.')
        }

        xterm.onData((data: string) => {
          if (bunSocket || bunInputQueue.length > 0) sendBunInput(data)
          else if (writer) writer.write(data)
        })

        xterm.onScroll(() => {
          if (!xterm) return
          const viewport = xterm.element?.querySelector('.xterm-viewport') as HTMLElement | null
          if (!viewport) return
          const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 8
          userScrolledUp = !atBottom
        })

        xterm.onLineFeed(() => {
          scrollToBottom()
        })

        unsubscribe = sandboxStore.subscribe(async (state) => {
          if (state.backend === 'bun') {
            if (!process) process = { kill() {} }
            return
          }

          if (!state.container || state.booting || !state.previewUrl) {
            if (process) {
              try {
                process.kill()
              } catch {}
              process = undefined
              writer = undefined
              attachedContainer = null
              spawning = false
            }
            return
          }

          if (process || spawning || !xterm || state.container === attachedContainer) return

          spawning = true
          const container = state.container
          try {
            const spawned = await container.spawn('jsh', [])
            if (state.container !== container || !xterm) {
              try {
                spawned.kill()
              } catch {}
              return
            }

            process = spawned
            attachedContainer = container
            void spawned.exit.catch(() => {})

            if (attachPreviewMessages) {
              container.on('preview-message', (msg: any) => {
                const text = msg.message || (msg.args ? msg.args.join(' ') : JSON.stringify(msg))
                xterm?.writeln(`\x1b[90m[preview]\x1b[0m ${text}`)
              })
            }
            writer = process.input.getWriter()

            void process.output
              .pipeTo(
                new WritableStream({
                  write(data) {
                    xterm?.write(data)
                    scrollToBottom()
                  },
                }),
              )
              .catch((pipeError: unknown) => {
                if (!isAbortedError(pipeError)) {
                  console.warn(`Terminal output stream closed (${sessionId}):`, pipeError)
                }
              })
          } catch (spawnError) {
            if (!isAbortedError(spawnError)) {
              console.error(`Failed to spawn jsh process (${sessionId}):`, spawnError)
              xterm?.write('\r\nFailed to start shell.\r\n')
            }
          } finally {
            spawning = false
          }
        })

        if (sandboxStore.getBackend() === 'bun') connectBunTerminal()
      } catch (importError) {
        console.error('Failed to import or initialize @xterm/xterm:', importError)
      }
    })()
  })

  onDestroy(() => {
    if (fitRafId !== null) cancelAnimationFrame(fitRafId)
    if (resizeObserver && terminalContainer) {
      try {
        resizeObserver.unobserve(terminalContainer)
      } catch {}
      resizeObserver.disconnect()
    }
    if (unsubscribe) unsubscribe()
    if (bunSocket) {
      bunSocket.onclose = null
      try {
        bunSocket.close()
      } catch {}
      bunSocket = null
    }
    if (writer) {
      try {
        writer.releaseLock()
      } catch {}
    }
    if (process) {
      try {
        process.kill()
      } catch (killError) {
        console.warn('Error killing process:', killError)
      }
    }
    if (xterm) {
      xterm.dispose()
    }
  })
</script>

<div class="terminal-outer">
  <div class="terminal-host">
    <div bind:this={terminalContainer} class="terminal-container"></div>
  </div>
</div>

<style>
  .terminal-outer {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--color-background);
    overflow: hidden;
  }

  .terminal-host {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
  }

  .terminal-container {
    position: absolute;
    inset: 0;
    padding: 8px;
    background: var(--color-background);
    overflow: hidden;
  }

  .terminal-container :global(.xterm) {
    height: 100%;
    width: 100%;
  }

  .terminal-container :global(.xterm-viewport) {
    overflow-y: auto !important;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }
</style>
