<script lang="ts">
  import FileIcon from '$lib/components/file-icon.svelte'
  import { basename } from '$lib/fileIcons'
  import BugIcon from '@lucide/svelte/icons/bug'
  import MonitorIcon from '@lucide/svelte/icons/monitor'
  import ScrollTextIcon from '@lucide/svelte/icons/scroll-text'
  import TerminalSquareIcon from '@lucide/svelte/icons/terminal'

  export type ContextChip = {
    id: string
    label: string
    title?: string
    active?: boolean
    kind: 'file' | 'pane'
    path?: string
    pane?: 'preview' | 'terminal' | 'logs' | 'console'
  }

  let { chips = [] }: { chips?: ContextChip[] } = $props()

  let scroller = $state<HTMLDivElement | undefined>()
  let fadeLeft = $state(false)
  let fadeRight = $state(false)

  function updateFades() {
    const el = scroller
    if (!el) {
      fadeLeft = false
      fadeRight = false
      return
    }

    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 1) {
      fadeLeft = false
      fadeRight = false
      return
    }

    fadeLeft = el.scrollLeft > 2
    fadeRight = el.scrollLeft < maxScroll - 2
  }

  $effect(() => {
    chips.length
    queueMicrotask(updateFades)
  })

  $effect(() => {
    const el = scroller
    if (!el) return

    const observer = new ResizeObserver(() => updateFades())
    observer.observe(el)
    el.addEventListener('scroll', updateFades, { passive: true })

    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', updateFades)
    }
  })
</script>

{#if chips.length}
  <div
    class="agent-context-chips-scroll"
    class:agent-context-chips-scroll--fade-left={fadeLeft}
    class:agent-context-chips-scroll--fade-right={fadeRight}
  >
    <div bind:this={scroller} class="agent-context-chips" aria-label="Workspace context">
      {#each chips as chip (chip.id)}
        <span
          class="agent-context-chips__chip"
          class:agent-context-chips__chip--active={chip.active}
          title={chip.title ?? chip.label}
        >
          {#if chip.kind === 'file' && chip.path}
            <FileIcon path={chip.path} class="size-3.5 shrink-0" />
          {:else if chip.pane === 'preview'}
            <MonitorIcon class="size-3.5 shrink-0" />
          {:else if chip.pane === 'terminal'}
            <TerminalSquareIcon class="size-3.5 shrink-0" />
          {:else if chip.pane === 'logs'}
            <ScrollTextIcon class="size-3.5 shrink-0" />
          {:else if chip.pane === 'console'}
            <BugIcon class="size-3.5 shrink-0" />
          {/if}
          <span class="truncate">{chip.label}</span>
        </span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .agent-context-chips-scroll {
    position: relative;
    margin-top: 0.375rem;
  }

  .agent-context-chips-scroll::before,
  .agent-context-chips-scroll::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1.75rem;
    z-index: 1;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .agent-context-chips-scroll::before {
    left: 0;
    background: linear-gradient(
      to right,
      var(--color-background) 0%,
      color-mix(in oklch, var(--color-background) 70%, transparent) 55%,
      transparent 100%
    );
  }

  .agent-context-chips-scroll::after {
    right: 0;
    background: linear-gradient(
      to left,
      var(--color-background) 0%,
      color-mix(in oklch, var(--color-background) 70%, transparent) 55%,
      transparent 100%
    );
  }

  .agent-context-chips-scroll--fade-left::before,
  .agent-context-chips-scroll--fade-right::after {
    opacity: 1;
  }

  .agent-context-chips {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.375rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 0.125rem;
    scrollbar-width: none;
  }

  .agent-context-chips::-webkit-scrollbar {
    display: none;
  }

  .agent-context-chips__chip {
    display: inline-flex;
    max-width: 10rem;
    flex-shrink: 0;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
    border-radius: 9999px;
    background: color-mix(in oklch, var(--color-muted) 40%, transparent);
    padding: 0.125rem 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-muted-foreground);
  }

  .agent-context-chips__chip--active {
    border-color: color-mix(in oklch, var(--color-primary) 45%, var(--color-border));
    color: var(--color-foreground);
    background: color-mix(in oklch, var(--color-primary) 10%, var(--color-muted));
  }
</style>
