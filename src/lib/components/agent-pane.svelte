<script lang="ts">
  import ChatTranscript from '$lib/components/chat-transcript.svelte'
  import AgentRailScrollOnOpen from '$lib/components/agent-rail-scroll-on-open.svelte'
  import AgentLiveEdgeFollower from '$lib/components/agent-live-edge-follower.svelte'
  import AgentComposerEditor from '$lib/components/agent-composer-editor.svelte'
  import BorderBeam from '$lib/components/ui/border-beam.svelte'
  import AgentContextChips, { type ContextChip } from '$lib/components/agent-context-chips.svelte'
  import ChatStatusMarker from '$lib/components/chat-status-marker.svelte'
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import ToolLog from '$lib/components/tool-log.svelte'
  import AgentApprovalPrompt from '$lib/components/agent-approval-prompt.svelte'
  import TurtleLogoMark from '$lib/components/turtle-logo-mark.svelte'
  import { approvalState, setApprovalMode } from '$lib/agent/approval/approvalStore.svelte'
  import * as Attachment from '$lib/components/ui/attachment/index.js'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import * as InputGroup from '$lib/components/ui/input-group/index.js'
  import * as MessageScroller from '$lib/components/ui/message-scroller/index.js'
  import { formatFileSize } from '$lib/ai/messages.js'
  import { getChatStatusLabel } from '$lib/ai/messages.js'
  import { getAgentChat, isAgentChatBusy, sendAgentChatMessage, stopAgentChat } from '$lib/agentChatSessions'
  import { chatSettings, chatModelCatalog, loadAvailableModels, setChatModel } from '$lib/chat/settings.svelte.js'
  import { PANEL_IDS } from '$lib/editorLayout'
  import { basename } from '$lib/fileIcons'
  import type { MentionItem } from '$lib/tiptap/mention-suggestion'
  import { toast } from '$lib/notify'
  import { sandboxStore } from '$lib/sandboxStore'
  import { onMount } from 'svelte'
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import CheckIcon from '@lucide/svelte/icons/check'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import ImageIcon from '@lucide/svelte/icons/image'
  import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal'
  import PaperclipIcon from '@lucide/svelte/icons/paperclip'
  import SquareIcon from '@lucide/svelte/icons/square'
  import XIcon from '@lucide/svelte/icons/x'

  export type AgentWorkspaceContext = {
    openFiles: string[]
    activeFile: string
    openTerminals: number
    panes: {
      preview: boolean
      logs: boolean
      console: boolean
    }
  }

  type PendingAttachment = {
    id: string
    file: File
    previewUrl: string | null
  }

  let {
    sessionId,
    knownPaths = [],
    workspaceContext = {
      openFiles: [],
      activeFile: '',
      openTerminals: 0,
      panes: { preview: false, logs: false, console: false },
    },
    canSplit = false,
    maximized = false,
    onSplit,
    onToggleMaximize,
  }: {
    sessionId: string
    knownPaths?: string[]
    workspaceContext?: AgentWorkspaceContext
    canSplit?: boolean
    maximized?: boolean
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
    onToggleMaximize?: () => void
  } = $props()

  let composerValue = $state('')
  let composerRef = $state<AgentComposerEditor | undefined>()
  let fileInput = $state<HTMLInputElement | undefined>()
  let pendingAttachments = $state<PendingAttachment[]>([])
  let bootPhase = $state('idle')
  let toolLogOpen = $state(false)

  const chat = $derived(getAgentChat(sessionId))
  const messages = $derived(chat.messages)
  const models = $derived(chatModelCatalog.available)
  const busy = $derived(isAgentChatBusy(sessionId))
  const isEmpty = $derived(messages.length === 0)

  const contextChips = $derived.by((): ContextChip[] => {
    const chips: ContextChip[] = []

    const openFiles = workspaceContext.openFiles
    const { activeFile } = workspaceContext
    const orderedFiles =
      activeFile && openFiles.includes(activeFile)
        ? [activeFile, ...openFiles.filter((path) => path !== activeFile)]
        : openFiles

    for (const path of orderedFiles) {
      chips.push({
        id: `file:${path}`,
        kind: 'file',
        path,
        label: basename(path),
        title: path,
        active: path === workspaceContext.activeFile,
      })
    }

    if (workspaceContext.panes.preview) {
      chips.push({ id: 'pane:preview', kind: 'pane', pane: 'preview', label: 'Preview' })
    }
    if (workspaceContext.openTerminals > 0) {
      chips.push({
        id: 'pane:terminal',
        kind: 'pane',
        pane: 'terminal',
        label: `Terminal${workspaceContext.openTerminals === 1 ? '' : 's'} · ${workspaceContext.openTerminals}`,
      })
    }
    if (workspaceContext.panes.logs) {
      chips.push({ id: 'pane:logs', kind: 'pane', pane: 'logs', label: 'Logs' })
    }
    if (workspaceContext.panes.console) {
      chips.push({ id: 'pane:console', kind: 'pane', pane: 'console', label: 'Console' })
    }

    return chips
  })

  const canSend = $derived(Boolean(composerValue.trim() || pendingAttachments.length))

  const statusLabel = $derived(getChatStatusLabel(chat.status, messages, busy))

  onMount(() => {
    void loadAvailableModels()
  })

  $effect(() => {
    const unsub = sandboxStore.subscribe((state) => {
      bootPhase = state.phase
    })
    return unsub
  })

  function showWip() {
    toast.info('WIP')
  }

  import { getActiveDiagnostics } from '$lib/agent/diagnostics/errorObserver.svelte'

  function searchMentions(query: string): MentionItem[] {
    const q = query.trim().toLowerCase()
    const paths = knownPaths.length ? knownPaths : workspaceContext.openFiles

    const contextItems: MentionItem[] = [
      { type: 'context', id: 'errors', label: 'errors', detail: 'Active runtime & compiler diagnostics' },
      { type: 'context', id: 'terminal', label: 'terminal', detail: 'Recent sandbox terminal logs' },
      { type: 'context', id: 'preview', label: 'preview', detail: 'Current preview status' },
    ]

    const fileItems: MentionItem[] = paths.map((filePath) => ({
      type: 'file' as const,
      id: filePath.replace(/^\//, ''),
      label: basename(filePath),
      detail: filePath,
    }))

    return [...contextItems, ...fileItems]
      .filter((item) => {
        if (!q) return true
        return item.label.toLowerCase().includes(q) || (item.detail && item.detail.toLowerCase().includes(q))
      })
      .slice(0, 15)
  }

  function addAttachments(files: File[]) {
    const next = files.map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    pendingAttachments = [...pendingAttachments, ...next]
  }

  function removeAttachment(id: string) {
    const target = pendingAttachments.find((entry) => entry.id === id)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    pendingAttachments = pendingAttachments.filter((entry) => entry.id !== id)
  }

  function openFilePicker() {
    fileInput?.click()
  }

  function handleFileSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const selected = input.files ? [...input.files] : []
    if (selected.length) addAttachments(selected)
    input.value = ''
  }

  function filesToFileList(files: File[]) {
    const dt = new DataTransfer()
    for (const file of files) dt.items.add(file)
    return dt.files
  }

  function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (const item of items) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file?.type.startsWith('image/')) imageFiles.push(file)
    }

    if (!imageFiles.length) return
    event.preventDefault()
    addAttachments(imageFiles)
  }

  async function submitMessage() {
    let text = composerValue.trim()
    if ((!text && !pendingAttachments.length) || busy) return

    // Expand special mentions if present
    if (text.includes('@errors')) {
      const diag = getActiveDiagnostics()
      if (diag.hasErrors) {
        const errorSummary = diag.diagnostics
          .map((d) => `[${d.kind}] ${d.file ? `${d.file}${d.line ? `:${d.line}` : ''}: ` : ''}${d.message}`)
          .join('\n')
        text += `\n\n<active_errors>\n${errorSummary}\n</active_errors>`
      }
    }

    if (text.includes('@terminal')) {
      let recentLogs: string[] = []
      const unsub = sandboxStore.subscribe((s) => (recentLogs = s.logs ?? []))
      unsub()
      if (recentLogs.length > 0) {
        text += `\n\n<recent_terminal_logs>\n${recentLogs.slice(-25).join('\n')}\n</recent_terminal_logs>`
      }
    }

    const files = pendingAttachments.length ? filesToFileList(pendingAttachments.map((entry) => entry.file)) : undefined

    for (const entry of pendingAttachments) {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl)
    }
    pendingAttachments = []
    composerRef?.clear()

    if (text && files) {
      await sendAgentChatMessage(sessionId, { text, files })
      return
    }
    if (files) {
      await sendAgentChatMessage(sessionId, { files })
      return
    }
    await sendAgentChatMessage(sessionId, { text })
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    await submitMessage()
  }

  function handleStop() {
    stopAgentChat(sessionId)
  }

  const buildIdeas = [
    'landing page',
    'dashboard',
    'todo app',
    'pricing table',
    'hero section',
    'contact form',
    'photo gallery',
    'login flow',
  ] as const

  let typewriterText = $state('')

  function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  $effect(() => {
    if (!maximized || !isEmpty) {
      typewriterText = ''
      return
    }

    let cancelled = false
    const prefix = 'Build a '

    async function runTypewriter() {
      let ideaIndex = 0
      while (!cancelled) {
        const suffix = `${buildIdeas[ideaIndex]}...`

        for (let i = 0; i <= suffix.length; i++) {
          if (cancelled) return
          typewriterText = prefix + suffix.slice(0, i)
          await sleep(55)
        }

        await sleep(1800)
        if (cancelled) return

        for (let i = suffix.length; i >= 0; i--) {
          if (cancelled) return
          typewriterText = prefix + suffix.slice(0, i)
          await sleep(32)
        }

        ideaIndex = (ideaIndex + 1) % buildIdeas.length
        await sleep(350)
      }
    }

    void runTypewriter()
    return () => {
      cancelled = true
    }
  })
</script>

<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  multiple
  class="sr-only"
  aria-hidden="true"
  tabindex="-1"
  onchange={handleFileSelection}
/>

<PaneChrome paneKind="chat" paneId={PANEL_IDS.agent} id="agent-pane-panel">
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">{bootPhase}</span>
      {/snippet}

      {#snippet actions()}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                type="button"
                class="pane-toolbar__btn"
                title="Agent options"
                aria-label="Agent options"
              >
                <MoreHorizontalIcon class="size-3.5" />
              </button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-44">
            <DropdownMenu.Item onclick={showWip}>Slash commands</DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => (toolLogOpen = !toolLogOpen)}>
              Agent logs
              {#if toolLogOpen}
                <CheckIcon class="ms-auto size-3.5" />
              {/if}
            </DropdownMenu.Item>
            <DropdownMenu.Item onclick={showWip}>Trace</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onclick={() =>
                setApprovalMode(approvalState.mode === 'auto-allow' ? 'prompt' : 'auto-allow')}
            >
              Auto-approve writes
              {#if approvalState.mode === 'auto-allow'}
                <CheckIcon class="ms-auto size-3.5" />
              {/if}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <PaneMaximizeButton {maximized} onToggle={onToggleMaximize} />
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <div
      class="agent-pane text-sm"
      class:agent-pane--maximized={maximized}
      class:agent-pane--empty={isEmpty}
    >
      <MessageScroller.Provider autoScroll defaultScrollPosition="end" scrollPreviousItemPeek={32}>
        <AgentRailScrollOnOpen open={true} />
        <AgentLiveEdgeFollower {busy} />
        <div class="agent-pane__main">
          <div class="agent-pane__chat">
            {#if isEmpty}
              <div class="agent-pane__empty" aria-hidden={busy}>
                {#if maximized}
                  <div class="agent-pane__hero">
                    <TurtleLogoMark class="agent-pane__hero-mark" />
                    <p class="agent-pane__hero-title">What should we build?</p>
                  </div>
                {:else}
                  <TurtleLogoMark />
                {/if}
              </div>
              {#if busy && statusLabel}
                <div class="agent-pane__status">
                  <ChatStatusMarker label={statusLabel} />
                </div>
              {/if}
            {:else}
              <ChatTranscript {sessionId} {busy} />
            {/if}
          </div>

          {#if toolLogOpen}
            <ToolLog {sessionId} />
          {/if}

          <AgentApprovalPrompt />

          <form class="agent-pane__composer" onsubmit={handleSubmit} onpaste={handlePaste}>
        <InputGroup.Root
          class="agent-pane__input items-stretch rounded-lg border border-border shadow-none"
        >
          {#if busy}
            <BorderBeam size={80} duration={12} borderWidth={1} colorFrom="#ffffff" colorTo="#ffffff" pathRadius={8} />
          {/if}
          {#if pendingAttachments.length}
            <div class="px-2 pt-2">
              <Attachment.Group>
                {#each pendingAttachments as attachment (attachment.id)}
                  <Attachment.Root size="sm">
                    <Attachment.Media variant={attachment.previewUrl ? 'image' : 'icon'}>
                      {#if attachment.previewUrl}
                        <img src={attachment.previewUrl} alt="" class="size-full object-cover" />
                      {:else}
                        <ImageIcon class="size-4" />
                      {/if}
                    </Attachment.Media>
                    <Attachment.Content>
                      <Attachment.Title>{attachment.file.name}</Attachment.Title>
                      <Attachment.Description>
                        {attachment.file.type || 'File'} · {formatFileSize(attachment.file.size)}
                      </Attachment.Description>
                    </Attachment.Content>
                    <Attachment.Actions>
                      <Attachment.Action
                        aria-label={`Remove ${attachment.file.name}`}
                        onclick={() => removeAttachment(attachment.id)}
                      >
                        <XIcon class="size-3" />
                      </Attachment.Action>
                    </Attachment.Actions>
                  </Attachment.Root>
                {/each}
              </Attachment.Group>
            </div>
          {/if}

          <AgentComposerEditor
            bind:this={composerRef}
            bind:value={composerValue}
            disabled={busy}
            placeholder={maximized && isEmpty ? 'How can I help you today?' : 'Message agent…'}
            mentionSearch={searchMentions}
            onSubmit={() => void submitMessage()}
            onPasteFiles={addAttachments}
          />

          <InputGroup.Addon align="block-end" class="agent-pane__composer-footer gap-1 pb-1.5 pe-1.5 ps-1.5 pt-0">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <button {...props} type="button" class="agent-pane__model-pill" aria-label="Choose model">
                    <span class="truncate">{chatSettings.model}</span>
                    <ChevronDownIcon class="size-3 shrink-0 opacity-70" />
                  </button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="top" class="max-h-64 w-52 overflow-y-auto">
                <DropdownMenu.Label>Model</DropdownMenu.Label>
                {#each models as model (model)}
                  <DropdownMenu.Item onclick={() => setChatModel(model)}>
                    <span class="truncate">{model}</span>
                    {#if chatSettings.model === model}
                      <CheckIcon class="ms-auto size-3.5" />
                    {/if}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <div class="ms-auto flex items-center gap-1">
              <InputGroup.Button type="button" size="icon-sm" aria-label="Attach image" onclick={openFilePicker}>
                <PaperclipIcon class="size-3.5" />
              </InputGroup.Button>
              {#if busy}
                <InputGroup.Button
                  class="rounded-full bg-destructive text-destructive-foreground"
                  type="button"
                  size="icon-sm"
                  aria-label="Stop"
                  onclick={handleStop}
                >
                  <SquareIcon class="size-3 fill-current" />
                </InputGroup.Button>
              {:else}
                <InputGroup.Button
                  class="rounded-full bg-primary text-primary-foreground"
                  type="submit"
                  size="icon-sm"
                  aria-label="Send"
                  disabled={!canSend}
                >
                  <ArrowUpIcon class="size-3.5" />
                </InputGroup.Button>
              {/if}
            </div>
          </InputGroup.Addon>
        </InputGroup.Root>

        {#if maximized && isEmpty}
          <p class="agent-pane__typewriter" aria-live="polite">
            {typewriterText}<span class="agent-pane__typewriter-cursor" aria-hidden="true">|</span>
          </p>
        {:else}
          <AgentContextChips chips={contextChips} />
        {/if}
          </form>
        </div>
      </MessageScroller.Provider>
    </div>
  {/snippet}
</PaneChrome>

<style>
  .agent-pane {
    --agent-thread-max-width: 48rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--color-agent-chat-surface);
  }

  .agent-pane__main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .agent-pane__chat {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0.5rem;
  }

  .agent-pane__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 8rem;
    pointer-events: none;
  }

  .agent-pane__status {
    display: flex;
    justify-content: center;
    padding-bottom: 0.75rem;
  }

  .agent-pane__empty :global(svg:not(.agent-pane__hero-mark)) {
    width: 3rem;
    height: 3rem;
    flex-shrink: 0;
    color: var(--color-primary);
    opacity: 0.06;
  }

  .agent-pane__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    max-width: 28rem;
    text-align: center;
    pointer-events: none;
  }

  .agent-pane__hero :global(.agent-pane__hero-mark) {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    color: var(--color-primary);
    opacity: 0.85;
  }

  .agent-pane__hero-title {
    margin: 0;
    font-family: inherit;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--color-foreground);
  }

  .agent-pane__typewriter {
    margin: 0.5rem 0 0;
    padding: 0 0.125rem;
    min-height: 1.25rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8125rem;
    line-height: 1.25rem;
    color: var(--color-muted-foreground);
    text-align: center;
  }

  .agent-pane__typewriter-cursor {
    display: inline-block;
    margin-left: 1px;
    animation: agent-pane-cursor-blink 1s step-end infinite;
  }

  @keyframes agent-pane-cursor-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  .agent-pane__composer {
    padding: 0.5rem;
    padding-top: 0;
    flex-shrink: 0;
  }

  /* Fullscreen: centered column like a traditional chat app */
  .agent-pane--maximized .agent-pane__main {
    width: min(100%, var(--agent-thread-max-width));
    margin-inline: auto;
  }

  .agent-pane--maximized .agent-pane__chat {
    padding-inline: 1rem;
  }

  .agent-pane--maximized .agent-pane__composer {
    padding-inline: 1rem;
    padding-bottom: 1rem;
  }

  .agent-pane--maximized :global([data-slot='message-scroller-content']) {
    width: 100%;
    padding-inline: 0.5rem;
  }

  .agent-pane--maximized.agent-pane--empty .agent-pane__main {
    justify-content: center;
    gap: 1.5rem;
    padding: 1.5rem 1rem 2rem;
  }

  .agent-pane--maximized.agent-pane--empty .agent-pane__chat {
    flex: 0 0 auto;
    padding: 0;
    overflow: visible;
  }

  .agent-pane--maximized.agent-pane--empty .agent-pane__empty {
    flex: 0 0 auto;
    min-height: 0;
  }

  .agent-pane--maximized.agent-pane--empty .agent-pane__composer {
    width: 100%;
    padding: 0;
  }

  .agent-pane--maximized.agent-pane--empty :global(.agent-pane__input) {
    border-radius: 1rem !important;
    box-shadow: 0 1px 0 color-mix(in oklch, var(--color-foreground) 6%, transparent);
  }

  :global(.agent-pane__input) {
    position: relative;
    overflow: hidden;
    align-items: stretch !important;
    background: var(--color-agent-composer-surface) !important;
    border-color: var(--color-border) !important;
    opacity: 1 !important;
  }

  .agent-pane__composer-footer {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
  }

  .agent-pane__model-pill {
    display: inline-flex;
    max-width: 9rem;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--color-border);
    border-radius: 9999px;
    background: color-mix(in oklch, var(--color-muted) 55%, var(--color-background));
    padding: 0.125rem 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-muted-foreground);
    cursor: pointer;
  }

  .agent-pane__model-pill:hover {
    color: var(--color-foreground);
    border-color: var(--color-border);
  }
</style>
