<script lang="ts">
  import { settings } from '$lib/settings/store.svelte'
  import { getTerminalSession } from '$lib/terminalSession'

  let {
    sessionId = 'default',
    attachPreviewMessages = false,
  }: {
    sessionId?: string
    attachPreviewMessages?: boolean
  } = $props()

  let terminalContainer = $state<HTMLDivElement | null>(null)

  $effect(() => {
    const container = terminalContainer
    if (!container) return
    const session = getTerminalSession(sessionId)
    session.attach(container)
    return () => session.detach(container)
  })

  $effect(() => {
    const session = getTerminalSession(sessionId)
    session.setAttachPreviewMessages(attachPreviewMessages)
  })

  $effect(() => {
    settings.typography.terminalFontSize
    settings.theme.presetId
    settings.theme.colorScheme
    getTerminalSession(sessionId).scheduleFit()
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

  /* xterm 5.6+: viewport is an empty background layer; scrolling uses .xterm-scrollable-element */
  .terminal-container :global(.xterm-viewport) {
    pointer-events: none;
  }

  .terminal-container :global(.xterm-scrollable-element) {
    height: 100%;
    overscroll-behavior: contain;
  }
</style>
