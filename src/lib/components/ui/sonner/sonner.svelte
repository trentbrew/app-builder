<script lang="ts">
  import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner'
  import { mode } from 'mode-watcher'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
  import OctagonXIcon from '@lucide/svelte/icons/octagon-x'
  import InfoIcon from '@lucide/svelte/icons/info'
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
  import XIcon from '@lucide/svelte/icons/x'

  let { toastOptions, ...restProps }: SonnerProps = $props()

  const mergedToastOptions = $derived({
    ...toastOptions,
    classes: {
      toast: 'cn-toast',
      title: 'cn-toast__title',
      description: 'cn-toast__description',
      closeButton: 'cn-toast__close',
      actionButton: 'cn-toast__action',
      cancelButton: 'cn-toast__cancel',
      ...toastOptions?.classes,
    },
  })
</script>

<Sonner
  theme={mode.current}
  class="toaster group"
  toastOptions={mergedToastOptions}
  style="
		--normal-bg: var(--color-popover);
		--normal-text: var(--color-popover-foreground);
		--normal-border: var(--color-border);
		--border-radius: 1rem;
		--width: 24rem;
	"
  {...restProps}
>
  {#snippet loadingIcon()}
    <Loader2Icon class="size-4 animate-spin" />
  {/snippet}
  {#snippet successIcon()}
    <CircleCheckIcon class="size-4" />
  {/snippet}
  {#snippet errorIcon()}
    <OctagonXIcon class="size-4 text-destructive" />
  {/snippet}
  {#snippet infoIcon()}
    <InfoIcon class="size-4" />
  {/snippet}
  {#snippet warningIcon()}
    <TriangleAlertIcon class="size-4" />
  {/snippet}
  {#snippet closeIcon()}
    <XIcon class="size-4" />
  {/snippet}
</Sonner>

<style>
  :global(.toaster[data-sonner-toaster]) {
    --toast-close-button-start: unset;
    --toast-close-button-end: 1rem;
    --toast-close-button-transform: none;
    --toast-icon-margin-start: 0;
    --toast-icon-margin-end: 0;
    font-family: var(--font-sans);
  }

  :global(.toaster [data-sonner-toast][data-styled='true']) {
    padding: 1rem 2.75rem 1rem 1rem;
    align-items: flex-start;
    gap: 0.75rem;
    border-radius: 1rem;
    box-shadow:
      0 10px 15px -3px rgb(0 0 0 / 0.1),
      0 4px 6px -4px rgb(0 0 0 / 0.1);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  :global(.toaster [data-sonner-toast][data-styled='true'] [data-icon]) {
    height: 1rem;
    width: 1rem;
    margin-top: 0.125rem;
    color: var(--color-popover-foreground);
  }

  :global(.toaster [data-sonner-toast][data-styled='true'] [data-icon] svg) {
    margin: 0;
  }

  :global(.toaster [data-sonner-toast][data-type='error'] [data-icon]) {
    color: var(--color-destructive);
  }

  :global(.toaster [data-sonner-toast][data-styled='true'] [data-content]) {
    gap: 0.125rem;
    padding-right: 0;
  }

  :global(.toaster [data-sonner-toast] .cn-toast__title),
  :global(.toaster [data-sonner-toast][data-styled='true'] [data-title]) {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
  }

  :global(.toaster [data-sonner-toast] .cn-toast__description),
  :global(.toaster [data-sonner-toast][data-styled='true'] [data-description]) {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-muted-foreground);
  }

  :global(.toaster [data-sonner-toast][data-styled='true'] [data-close-button]) {
    top: 0.875rem;
    right: 0.75rem;
    left: auto;
    width: 1rem;
    height: 1rem;
    transform: none;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--color-muted-foreground);
    opacity: 0;
    transition:
      opacity 150ms ease,
      color 150ms ease;
  }

  :global(.toaster [data-sonner-toast][data-styled='true']:hover [data-close-button]),
  :global(.toaster [data-sonner-toast][data-styled='true'] [data-close-button]:focus-visible) {
    opacity: 1;
  }

  :global(.toaster [data-sonner-toast][data-styled='true'] [data-close-button]:hover) {
    background: transparent;
    border-color: transparent;
    color: var(--color-foreground);
  }

  :global(.toaster [data-sonner-toast][data-styled='true'] [data-button]) {
    height: 1.75rem;
    padding-inline: 0.625rem;
    border-radius: calc(var(--radius) - 2px);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-popover-foreground);
    background: var(--color-muted);
  }

  :global(.toaster [data-sonner-toast][data-styled='true'] [data-cancel]) {
    color: var(--color-popover-foreground);
    background: transparent;
  }
</style>
