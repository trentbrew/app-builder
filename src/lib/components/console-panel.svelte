<script lang="ts">
  import { previewConsole, type PreviewConsoleLevel } from '$lib/previewConsole.svelte'
  import '$lib/previewConsole'

  let container = $state<HTMLElement | undefined>()
  let userScrolledUp = $state(false)

  const entries = $derived(previewConsole.entries)

  function isAtBottom(el: HTMLElement) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 8
  }

  function levelClass(level: PreviewConsoleLevel) {
    switch (level) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'info':
        return 'text-sky-400'
      case 'debug':
        return 'text-violet-400'
      default:
        return 'text-foreground/90'
    }
  }

  function formatTime(time: number) {
    return new Date(time).toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  $effect(() => {
    const el = container
    if (!el) return

    const onScroll = () => {
      userScrolledUp = !isAtBottom(el)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  })

  $effect(() => {
    const el = container
    if (!el || userScrolledUp) return
    entries
    el.scrollTop = el.scrollHeight
  })
</script>

<div bind:this={container} class="console-panel terminal-output h-full min-h-0 overflow-y-auto p-3">
  {#if entries.length === 0}
    <p class="text-muted-foreground">Preview console output will appear here…</p>
  {:else}
    {#each entries as entry (entry.id)}
      <div class="console-panel__line flex gap-2 py-0.5">
        <span class="text-muted-foreground shrink-0 tabular-nums">{formatTime(entry.time)}</span>
        <span class="text-muted-foreground shrink-0 uppercase">{entry.level}</span>
        <span class="min-w-0 whitespace-pre-wrap break-words {levelClass(entry.level)}">{entry.text}</span>
      </div>
    {/each}
  {/if}
</div>
