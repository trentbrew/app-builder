<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import NodeLoadingOverlay from '$lib/components/node-loading-overlay.svelte'
  import ProjectSwitchOverlay from '$lib/components/project-switch-overlay.svelte'
  import {
    registerPreviewAnchor,
    registerPreviewChrome,
    refreshPreviewPosition,
    setPreviewUrl,
  } from '$lib/previewFrame'
  import { previewConsole } from '$lib/previewConsole.svelte'
  import { previewMobile } from '$lib/previewMobile.svelte'
  import { projectSwitch } from '$lib/projects/projectSwitch.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { toast } from '$lib/notify'

  let loading = $state(false)
  let booting = $state(false)
  let error = $state('')
  let previewUrl = $state('')
  let bootPhase = $state('idle')
  let backend = $state<'bun' | 'webcontainer' | 'unknown'>('unknown')
  let templateId = $state<string | null>(null)
  let wasBooting = $state(false)

  const showMobileFrame = $derived(templateId === 'expo' && previewMobile.enabled)

  onMount(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      loading = state.loading
      booting = state.booting
      error = state.error
      previewUrl = state.previewUrl
      bootPhase = state.phase
      backend = state.backend
      templateId = state.templateId
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
    showMobileFrame
    blockPreviewIframe
    refreshPreviewPosition()
  })

  const bootDetail = $derived(
    backend === 'bun'
      ? 'First boot installs via Bun on the local sandbox server — usually a few seconds.'
      : 'First boot can take 30–60s while npm installs inside WebContainer.',
  )
  const showProjectSwitch = $derived(projectSwitch.phase !== 'hidden')
  const showSimpleBoot = $derived((booting || loading) && !showProjectSwitch)
  const blockPreviewIframe = $derived(showSimpleBoot || Boolean(error))
  const showIdleStart = $derived(!booting && !loading && !previewUrl && !error && !showProjectSwitch)
  const bootProgress = $derived(
    showSimpleBoot || showProjectSwitch ? Math.max(projectSwitch.progress, booting || loading ? 4 : 0) : undefined,
  )
</script>

<div class="bg-background relative h-full min-h-0" aria-busy={showProjectSwitch || booting || loading}>
  <!-- Keep the iframe slot mounted at all times so preview state survives layout updates. -->
  {#if showMobileFrame}
    <div
      class="preview-mobile-stage absolute inset-0"
      class:pointer-events-none={blockPreviewIframe}
      class:invisible={blockPreviewIframe}
      aria-hidden={blockPreviewIframe}
    >
      <div class="preview-phone-shell" use:registerPreviewChrome>
        <div
          class="preview-phone-screen"
          data-preview-screen="mobile"
          class:pointer-events-none={blockPreviewIframe}
          class:invisible={blockPreviewIframe}
          aria-hidden={blockPreviewIframe}
          use:registerPreviewAnchor
        ></div>
      </div>
    </div>
  {:else}
    <div
      class="absolute inset-0"
      class:pointer-events-none={blockPreviewIframe}
      class:invisible={blockPreviewIframe}
      aria-hidden={blockPreviewIframe}
      use:registerPreviewAnchor
    ></div>
  {/if}

  <ProjectSwitchOverlay />

  {#if !showProjectSwitch}
    {#if showIdleStart}
      <div
        class="text-muted-foreground relative z-10 flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm"
      >
        <p>Starting preview…</p>
        <Button size="sm" variant="outline" onclick={() => sandboxStore.boot()}>Start preview</Button>
      </div>
    {:else if showSimpleBoot}
      <NodeLoadingOverlay
        title="Loading preview"
        message={bootPhase || 'Starting…'}
        detail={bootDetail}
        progress={bootProgress}
        progressAtTop
      />
    {:else if error}
      <div
        class="text-destructive relative z-10 flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm"
      >
        <h3 class="font-medium">Error</h3>
        <p>{error}</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .preview-mobile-stage {
    container-type: size;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background:
      radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--color-primary) 8%, transparent), transparent 55%),
      var(--color-background);
  }

  :global(.preview-phone-shell) {
    position: relative;
    aspect-ratio: 9 / 19.5;
    width: min(22.5rem, 100cqw, calc(100cqh * 9 / 19.5));
    height: auto;
    max-height: 100cqh;
    flex-shrink: 0;
    border-radius: 2.25rem;
    pointer-events: none;
  }

  :global([data-preview-chrome]) {
    border-radius: 2.25rem;
    border: 3px solid color-mix(in oklch, var(--color-foreground) 18%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--color-foreground) 10%, transparent),
      0 24px 48px color-mix(in oklch, #000 35%, transparent);
  }

  :global(.preview-phone-screen) {
    position: absolute;
    inset: 3px;
    border-radius: calc(2.25rem - 3px);
    overflow: hidden;
    background: #000;
  }

  :global([data-preview-chrome])::after {
    content: '';
    position: absolute;
    top: 0.45rem;
    left: 50%;
    width: 6.5rem;
    height: 1.35rem;
    transform: translateX(-50%);
    border-radius: 0 0 1rem 1rem;
    background: color-mix(in oklch, var(--color-foreground) 18%, transparent);
  }
</style>
