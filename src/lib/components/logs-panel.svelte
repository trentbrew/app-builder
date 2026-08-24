<script lang="ts">
  import { onMount } from 'svelte'
  import { sandboxStore } from '$lib/sandboxStore'

  let logs = $state<string[]>([])
  let logsContainer = $state<HTMLElement | undefined>()
  let userScrolledUp = $state(false)

  onMount(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      logs = state.logs
    })

    return unsubscribe
  })

  function isAtBottom(container: HTMLElement) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < 5
  }

  $effect(() => {
    const container = logsContainer
    if (!container) return

    const onScroll = () => {
      userScrolledUp = !isAtBottom(container)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  })

  $effect(() => {
    const container = logsContainer
    if (!container || userScrolledUp) return
    logs
    container.scrollTop = container.scrollHeight
  })

  const logText = $derived(logs.slice(-80).join('\n') || 'Waiting for server output…')
</script>

<pre
  class="h-full min-h-0 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
  bind:this={logsContainer}>{logText}</pre>
