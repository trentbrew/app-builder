<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import ChatTranscript from '$lib/components/chat-transcript.svelte'
  import AgentRailScrollOnOpen from '$lib/components/agent-rail-scroll-on-open.svelte'
  import HarnessStatus from '$lib/components/harness-status.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import ToolLog from '$lib/components/tool-log.svelte'
  import * as InputGroup from '$lib/components/ui/input-group/index.js'
  import * as MessageScroller from '$lib/components/ui/message-scroller/index.js'
  import { chat, isChatBusy, sendChatMessage } from '$lib/chat.svelte'
  import {
    closeAgentPanel,
    harnessStore,
    setAgentRailOverlay,
    setAgentRailWidth,
    toggleHarnessStatusPanel,
    toggleToolLogPanel,
  } from '$lib/agentHarness/harnessStore.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import ListTreeIcon from '@lucide/svelte/icons/list-tree'
  import ScrollTextIcon from '@lucide/svelte/icons/scroll-text'

  let draft = $state('')
  let narrow = $state(false)
  let bootPhase = $state('idle')
  let resizing = $state(false)

  const messages = $derived(chat.messages)
  const busy = $derived(isChatBusy())
  const streaming = $derived(chat.status === 'streaming')
  const expanded = $derived(!harnessStore.railCollapsed)
  const overlayOpen = $derived(narrow && expanded && harnessStore.railOverlay)
  const railWidth = $derived(harnessStore.railWidth)

  $effect(() => {
    const unsub = sandboxStore.subscribe((state) => {
      bootPhase = state.phase
    })
    return unsub
  })

  onMount(() => {
    if (!browser) return
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => {
      narrow = mq.matches
      if (!mq.matches) setAgentRailOverlay(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  })

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    draft = ''
    await sendChatMessage({ text })
  }

  function startResize(event: PointerEvent) {
    if (narrow) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = harnessStore.railWidth
    resizing = true

    const onMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX
      setAgentRailWidth(startWidth + delta)
    }

    const onUp = () => {
      resizing = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
</script>

{#if expanded}
  {#if overlayOpen}
    <button
      type="button"
      class="agent-rail__backdrop"
      aria-label="Close agent panel"
      onclick={() => closeAgentPanel()}
    ></button>
  {/if}

  <aside
    id="agent-rail-panel"
    class="agent-rail"
    class:agent-rail--overlay={overlayOpen}
    class:agent-rail--resizing={resizing}
    style:width={overlayOpen ? 'min(100vw, 360px)' : `${railWidth}px`}
    role="complementary"
    aria-label="Agent rail"
  >
    {#if !overlayOpen}
      <div
        class="agent-rail__resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent panel"
        onpointerdown={startResize}
      ></div>
    {/if}

    <div class="agent-rail__pane">
      <PaneToolbar>
        {#snippet meta()}
          <MessageCircleIcon class="size-3.5 shrink-0 opacity-80" />
          <span class="pane-toolbar__label">Agent</span>
          <span class="pane-toolbar__sep" aria-hidden="true"></span>
          <span class="pane-toolbar__detail">{bootPhase}</span>
        {/snippet}

        {#snippet actions()}
          <div class="pane-toolbar__group" role="group" aria-label="Agent panels">
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={harnessStore.statusPanelOpen}
              title={harnessStore.statusPanelOpen ? 'Hide harness status' : 'Show harness status'}
              aria-label={harnessStore.statusPanelOpen ? 'Hide harness status' : 'Show harness status'}
              aria-pressed={harnessStore.statusPanelOpen}
              onclick={() => toggleHarnessStatusPanel()}
            >
              <ListTreeIcon class="size-3.5" />
            </button>
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={harnessStore.toolLogOpen}
              title={harnessStore.toolLogOpen ? 'Hide tool log' : 'Show tool log'}
              aria-label={harnessStore.toolLogOpen ? 'Hide tool log' : 'Show tool log'}
              aria-pressed={harnessStore.toolLogOpen}
              onclick={() => toggleToolLogPanel()}
            >
              <ScrollTextIcon class="size-3.5" />
            </button>
          </div>
        {/snippet}
      </PaneToolbar>

      <div class="agent-rail__body">
        <MessageScroller.Provider autoScroll defaultScrollPosition="end" scrollPreviousItemPeek={32}>
          <AgentRailScrollOnOpen open={expanded} />
          <div class="agent-rail__chat">
            {#if messages.length === 0}
              <p class="agent-rail__hint">Ask the agent to reshape the guest UI via hot-write + HMR.</p>
            {:else}
              <ChatTranscript busy={streaming} />
            {/if}
          </div>
        </MessageScroller.Provider>

        <form class="agent-rail__composer" onsubmit={handleSubmit}>
          <InputGroup.Root class="rounded-lg border-border/80 bg-background shadow-none">
            <InputGroup.Textarea
              bind:value={draft}
              rows={2}
              placeholder="Message agent…"
              aria-label="Agent message"
              disabled={busy}
              class="min-h-10 py-2 text-sm"
              onkeydown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <InputGroup.Addon align="block-end" class="justify-end pb-1.5 pe-1.5 pt-0">
              <InputGroup.Button type="submit" size="icon-sm" aria-label="Send" disabled={busy || !draft.trim()}>
                <ArrowUpIcon class="size-3.5" />
              </InputGroup.Button>
            </InputGroup.Addon>
          </InputGroup.Root>
        </form>

        {#if harnessStore.statusPanelOpen}
          <HarnessStatus showPhase={false} />
        {/if}
        {#if harnessStore.toolLogOpen}
          <ToolLog />
        {/if}
      </div>
    </div>
  </aside>
{/if}

<style>
  .agent-rail {
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    min-height: 0;
    border-left: 1px solid var(--border);
    background: var(--card);
    color: var(--card-foreground);
  }

  .agent-rail--resizing {
    user-select: none;
  }

  .agent-rail__resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 6px;
    cursor: col-resize;
    touch-action: none;
    z-index: 2;
  }

  .agent-rail__resize-handle:hover,
  .agent-rail--resizing .agent-rail__resize-handle {
    background: color-mix(in oklch, var(--color-primary) 35%, transparent);
  }

  .agent-rail__pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
    background: var(--color-background);
  }

  .agent-rail--overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    box-shadow: -8px 0 24px rgb(0 0 0 / 35%);
  }

  .agent-rail__backdrop {
    position: fixed;
    inset: 0;
    z-index: 35;
    border: 0;
    background: rgb(0 0 0 / 45%);
    cursor: pointer;
  }

  .agent-rail__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .agent-rail__chat {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0.5rem;
  }

  .agent-rail__hint {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    padding: 0.5rem;
    line-height: 1.45;
  }

  .agent-rail__composer {
    padding: 0.5rem;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  :global(:root[data-editor-pane-style='cards']) .agent-rail:not(.agent-rail--overlay) {
    border-left: none;
    background: transparent;
  }

  :global(:root[data-editor-pane-style='cards']) .agent-rail:not(.agent-rail--overlay) .agent-rail__pane {
    border: 1px solid var(--color-border);
    border-radius: var(--editor-pane-radius);
    overflow: hidden;
    box-shadow: 0 1px 2px color-mix(in oklch, var(--color-foreground) 5%, transparent);
    background: var(--color-background);
  }
</style>
