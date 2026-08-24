<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { registerPreviewAnchor, refreshPreviewPosition, setPreviewUrl } from '$lib/previewFrame'
  import { previewConsole } from '$lib/previewConsole.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { toast } from 'svelte-sonner'

  let loading = $state(false)
  let booting = $state(false)
  let error = $state('')
  let previewUrl = $state('')
  let bootPhase = $state('idle')
  let backend = $state<'bun' | 'webcontainer' | 'unknown'>('unknown')
  let wasBooting = $state(false)

  onMount(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      loading = state.loading
      booting = state.booting
      error = state.error
      previewUrl = state.previewUrl
      bootPhase = state.phase
      backend = state.backend
    })

    if (browser) {
      window.addEventListener('message', handleIframeMessage)
    }

    return () => {
      unsubscribe()
      if (browser) {
        window.removeEventListener('message', handleIframeMessage)
      }
    }
  })

  function handleIframeMessage(event: MessageEvent) {
    if (event.data?.type === 'gamepad') {
      const label = event.data.label ?? 'Controller'
      if (event.data.event === 'connected') {
        toast.success(`${label} connected`)
      } else if (event.data.event === 'disconnected') {
        toast.info(`${label} disconnected`)
      }
    }
  }

  $effect(() => {
    if (booting && !wasBooting) {
      previewConsole.clear()
    }
    wasBooting = booting
  })

  $effect(() => {
    if (previewUrl) setPreviewUrl(previewUrl)
  })

  $effect(() => {
    showOverlay
    refreshPreviewPosition()
  })

  const showOverlay = $derived(booting || loading || Boolean(error) || !previewUrl)
</script>

<div class="bg-background relative h-full min-h-0">
  <!-- Keep the iframe slot mounted at all times so preview state survives layout updates. -->
  <div
    class="absolute inset-0"
    class:pointer-events-none={showOverlay}
    class:invisible={showOverlay}
    aria-hidden={showOverlay}
    use:registerPreviewAnchor
  ></div>

  {#if !booting && !loading && !previewUrl && !error}
    <div
      class="text-muted-foreground relative z-10 flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm"
    >
      <p>Starting preview…</p>
      <Button size="sm" variant="outline" onclick={() => sandboxStore.boot()}>Start preview</Button>
    </div>
  {:else if loading || booting}
    <div
      class="text-muted-foreground relative z-10 flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm"
    >
      <p>Loading preview…</p>
      <p class="text-foreground/80 text-xs font-medium">{bootPhase}</p>
      <p class="text-xs opacity-75">
        {#if backend === 'bun'}
          First boot installs via Bun on the local sandbox server — usually a few seconds.
        {:else}
          First boot can take 30–60s while npm installs inside WebContainer.
        {/if}
      </p>
    </div>
  {:else if error}
    <div
      class="text-destructive relative z-10 flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm"
    >
      <h3 class="font-medium">Error</h3>
      <p>{error}</p>
    </div>
  {/if}
</div>
