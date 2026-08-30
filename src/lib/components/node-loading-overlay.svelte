<script lang="ts">
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Progress } from '$lib/components/ui/progress/index.js'

  let {
    title,
    message,
    detail,
    progress,
    progressAtTop = false,
  }: {
    title: string
    message?: string
    detail?: string
    progress?: number
    progressAtTop?: boolean
  } = $props()

  const progressLabel = $derived(
    progress === undefined ? undefined : `${Math.round(Math.min(100, Math.max(0, progress)))}%`,
  )
  const showProgress = $derived(progress !== undefined)
</script>

<div
  class="node-loading-overlay"
  class:node-loading-overlay--progress-top={progressAtTop && showProgress}
  role="status"
  aria-live="polite"
  aria-busy="true"
  aria-valuenow={progress}
>
  {#if progressAtTop && showProgress}
    <div class="node-loading-overlay__top-progress">
      <Progress value={progress} class="h-0.5 rounded-none" />
    </div>
  {/if}

  <div class="node-loading-overlay__body">
    <Loader2Icon class="node-loading-overlay__icon" aria-hidden="true" />
    <div class="node-loading-overlay__copy">
      <p class="node-loading-overlay__title">{title}</p>
      {#if message}
        <p class="node-loading-overlay__message">{message}</p>
      {/if}
      {#if detail}
        <p class="node-loading-overlay__detail">{detail}</p>
      {/if}
      {#if showProgress && !progressAtTop}
        <div class="node-loading-overlay__progress">
          <Progress value={progress} class="h-1.5" />
          {#if progressLabel}
            <p class="node-loading-overlay__progress-label">{progressLabel}</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .node-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    background: color-mix(in oklch, var(--color-background) 88%, transparent);
    backdrop-filter: blur(4px);
  }

  .node-loading-overlay__body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.5rem;
    text-align: center;
  }

  .node-loading-overlay--progress-top .node-loading-overlay__body {
    padding-top: 1rem;
  }

  .node-loading-overlay__top-progress {
    width: 100%;
    flex-shrink: 0;
    background: linear-gradient(
      to bottom,
      color-mix(in oklch, var(--color-background) 92%, transparent),
      transparent
    );
  }

  .node-loading-overlay__icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--color-muted-foreground);
    animation: node-loading-overlay-spin 0.8s linear infinite;
  }

  .node-loading-overlay__copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    max-width: 16rem;
  }

  .node-loading-overlay__title {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-foreground);
  }

  .node-loading-overlay__message {
    margin: 0;
    font-size: 0.6875rem;
    color: var(--color-muted-foreground);
  }

  .node-loading-overlay__detail {
    margin: 0;
    font-size: 0.6875rem;
    color: color-mix(in oklch, var(--color-muted-foreground) 85%, transparent);
  }

  .node-loading-overlay__progress {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    max-width: 20rem;
    margin-top: 0.5rem;
  }

  .node-loading-overlay__progress-label {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-muted-foreground);
    text-align: right;
  }

  @keyframes node-loading-overlay-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .node-loading-overlay__icon {
      animation: none;
    }

    .node-loading-overlay :global([data-slot='progress-indicator']) {
      transition: none;
    }
  }
</style>
