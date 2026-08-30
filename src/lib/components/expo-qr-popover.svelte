<script lang="ts">
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import { toast } from '$lib/notify'
  import QrCodeIcon from '@lucide/svelte/icons/qr-code'
  import CopyIcon from '@lucide/svelte/icons/copy'

  let {
    url = '',
    disabled = false,
  }: {
    url?: string
    disabled?: boolean
  } = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let open = $state(false)
  let qrReady = $state(false)
  let qrUnavailable = $state(false)

  $effect(() => {
    if (!open || !url || !canvas) return
    qrReady = false
    qrUnavailable = false
    void import('qrcode')
      .then((QR) => {
        if (!canvas) return
        return QR.toCanvas(canvas, url, {
          width: 220,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        })
      })
      .then(() => {
        qrReady = true
      })
      .catch(() => {
        qrUnavailable = true
      })
  })

  async function copyUrl() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Copied Expo Go URL')
    } catch {
      toast.error('Could not copy URL')
    }
  }
</script>

<Popover bind:open>
  <PopoverTrigger
    class="pane-toolbar__btn"
    title="Scan with Expo Go"
    aria-label="Show Expo Go QR code"
    disabled={disabled || !url}
  >
    <QrCodeIcon class="size-3.5" />
  </PopoverTrigger>
  <PopoverContent align="end" class="w-72 gap-3 p-4">
    <div class="space-y-1">
      <p class="text-sm font-medium">Open on your phone</p>
      <p class="text-muted-foreground text-xs leading-relaxed">
        Scan with Expo Go, or paste the URL below into the app.
      </p>
    </div>
    <div class="bg-background flex min-h-[220px] items-center justify-center rounded-md border p-3">
      {#if qrUnavailable}
        <p class="text-muted-foreground px-2 text-center text-xs leading-relaxed">
          QR preview unavailable. Copy the URL below into Expo Go.
        </p>
      {:else}
        <canvas
          bind:this={canvas}
          width="220"
          height="220"
          class:opacity-0={!qrReady}
          aria-label="Expo Go QR code"
        ></canvas>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <code class="text-muted-foreground min-w-0 flex-1 truncate text-[0.625rem]">{url}</code>
      <button type="button" class="pane-toolbar__btn shrink-0" title="Copy Expo Go URL" onclick={copyUrl}>
        <CopyIcon class="size-3.5" />
      </button>
    </div>
  </PopoverContent>
</Popover>
