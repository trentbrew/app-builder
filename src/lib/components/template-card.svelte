<script lang="ts">
  import { onMount } from 'svelte'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import TemplateIcon from '$lib/components/template-icon.svelte'
  import { getTemplate } from '$lib/projects/templates'
  import type { UserTemplateRecord } from '$lib/projects/types'
  import { userTemplateStore } from '$lib/projects/userTemplateStore'
  import { getUserTemplateThumbnail } from '$lib/projects/projectThumbnail'
  import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal'

  type Props = {
    template: UserTemplateRecord
    onRenamed?: () => void
    onDeleted?: () => void
    onOpen?: (templateId: string) => void
    onUse?: (templateId: string) => void
  }

  let { template, onRenamed, onDeleted, onOpen, onUse }: Props = $props()

  let thumbnailUrl = $state('')

  const frameworkLabel = $derived(getTemplate(template.baseTemplateId).label)
  const relativeTime = $derived(formatRelative(template.updatedAt))
  const calendarDate = $derived(formatCalendarDate(template.updatedAt))

  onMount(() => {
    let cancelled = false
    void getUserTemplateThumbnail(template.id, template.baseTemplateId).then((url) => {
      if (!cancelled) thumbnailUrl = url
    })
    return () => {
      cancelled = true
    }
  })

  function formatRelative(ts: number) {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 48) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  function formatCalendarDate(ts: number) {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(ts))
  }

  function openTemplate() {
    onOpen?.(template.id)
  }

  function useTemplate() {
    onUse?.(template.id)
  }

  async function handleRename() {
    const next = window.prompt('Rename template', template.name)?.trim()
    if (!next || next === template.name) return
    await userTemplateStore.update(template.id, { name: next })
    onRenamed?.()
  }

  async function handleDuplicate() {
    await userTemplateStore.duplicate(template.id)
    onRenamed?.()
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return
    await userTemplateStore.delete(template.id)
    onDeleted?.()
  }
</script>

<article
  class="group border-border bg-card hover:ring-ring/40 focus-within:ring-ring relative flex flex-col overflow-hidden rounded-xl border transition hover:ring-2"
>
  <button type="button" class="text-card-foreground flex flex-1 flex-col text-left" onclick={openTemplate}>
    <div class="bg-muted/40 relative aspect-[16/10] w-full overflow-hidden">
      {#if thumbnailUrl}
        <img
          src={thumbnailUrl}
          alt=""
          class="template-card__thumb size-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
      {/if}
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent"
        aria-hidden="true"
      ></div>

      <div class="absolute right-2 bottom-2 z-10 flex items-center gap-1">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                class="bg-background/80 text-foreground/90 backdrop-blur-sm"
                aria-label="Template actions"
                onclick={(event) => event.stopPropagation()}
              >
                <MoreHorizontalIcon class="size-4" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-44">
            <DropdownMenu.Item onclick={openTemplate}>Edit template</DropdownMenu.Item>
            <DropdownMenu.Item onclick={useTemplate}>New project from template</DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => void handleRename()}>Rename</DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => void handleDuplicate()}>Duplicate</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item class="text-destructive" onclick={() => void handleDelete()}>Delete</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>

    <div class="flex flex-col gap-3 p-4">
      <div class="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
        <TemplateIcon templateId={template.baseTemplateId} class="size-3.5!" title={frameworkLabel} />
        <span>{frameworkLabel}</span>
        <span aria-hidden="true">·</span>
        <span title={calendarDate}>{relativeTime}</span>
      </div>
      <h2 class="line-clamp-2 text-sm font-semibold leading-snug">{template.name}</h2>
    </div>
  </button>
</article>

<style>
  .template-card__thumb {
    min-width: 100%;
    min-height: 100%;
    transform: scale(1.55);
    transform-origin: center center;
  }

  @media (prefers-reduced-motion: reduce) {
    .template-card__thumb {
      transform: scale(1.35);
    }
  }
</style>
