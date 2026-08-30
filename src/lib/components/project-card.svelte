<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import TemplateIcon from '$lib/components/template-icon.svelte'
  import { getTemplate } from '$lib/projects/templates'
  import type { ProjectRecord } from '$lib/projects/types'
  import { dexieProjectStore } from '$lib/projects/dexieProjectStore'
  import { userTemplateStore } from '$lib/projects/userTemplateStore'
  import { getProjectThumbnail } from '$lib/projects/projectThumbnail'
  import { toast } from '$lib/notify'
  import { cn } from '$lib/utils.js'
  import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal'
  import StarIcon from '@lucide/svelte/icons/star'

  type Props = {
    project: ProjectRecord
    onRenamed?: () => void
    onDeleted?: () => void
    onPinned?: () => void
  }

  let { project, onRenamed, onDeleted, onPinned }: Props = $props()

  let thumbnailUrl = $state('')
  let pinned = $state(Boolean(project.pinned))

  const templateLabel = $derived(getTemplate(project.templateId).label)

  const relativeTime = $derived(formatRelative(project.lastOpenedAt))
  const calendarDate = $derived(formatCalendarDate(project.lastOpenedAt))

  $effect(() => {
    pinned = Boolean(project.pinned)
  })

  onMount(() => {
    let cancelled = false
    void getProjectThumbnail(project.id, project.templateId).then((url) => {
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

  function openProject() {
    void goto(`/editor/${project.id}`)
  }

  async function handleRename() {
    const next = window.prompt('Rename project', project.name)?.trim()
    if (!next || next === project.name) return
    await dexieProjectStore.update(project.id, { name: next })
    onRenamed?.()
  }

  async function handleDuplicate() {
    const copy = await dexieProjectStore.duplicate(project.id)
    void goto(`/editor/${copy.id}`)
  }

  async function handleSaveAsTemplate() {
    const name = window.prompt('Template name', `${project.name} template`)?.trim()
    if (!name) return
    try {
      await userTemplateStore.createFromProject({ name, projectId: project.id })
      toast.success(`Saved "${name}" as a template`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save template')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    await dexieProjectStore.delete(project.id)
    onDeleted?.()
  }

  async function handleTogglePin(event?: MouseEvent) {
    event?.stopPropagation()
    event?.preventDefault()
    await dexieProjectStore.togglePin(project.id)
    pinned = !pinned
    onPinned?.()
  }
</script>

<article
  class={cn(
    'group border-border bg-card hover:ring-ring/40 focus-within:ring-ring relative flex flex-col overflow-hidden rounded-xl border transition hover:ring-2',
    pinned && 'ring-primary/30 ring-1',
  )}
>
  <button type="button" class="text-card-foreground flex flex-1 flex-col text-left" onclick={openProject}>
    <div class="bg-muted/40 relative aspect-[16/10] w-full overflow-hidden">
      {#if thumbnailUrl}
        <img
          src={thumbnailUrl}
          alt=""
          class="project-card__thumb size-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
      {/if}
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent"
        aria-hidden="true"
      ></div>

      <div class="absolute right-2 bottom-2 z-10 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          class={cn('bg-background/80 text-foreground/90 backdrop-blur-sm', pinned && 'text-primary')}
          aria-label={pinned ? 'Unpin project' : 'Pin project'}
          aria-pressed={pinned}
          onclick={handleTogglePin}
        >
          <StarIcon class={cn('size-4', pinned && 'fill-current')} />
        </Button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                class="bg-background/80 text-foreground/90 backdrop-blur-sm"
                aria-label="Project actions"
                onclick={(event) => event.stopPropagation()}
              >
                <MoreHorizontalIcon class="size-4" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-40">
            <DropdownMenu.Item onclick={openProject}>Open</DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => void handleTogglePin()}>{pinned ? 'Unpin' : 'Pin'}</DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => void handleRename()}>Rename</DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => void handleDuplicate()}>Duplicate</DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => void handleSaveAsTemplate()}>Save as template</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item class="text-destructive" onclick={() => void handleDelete()}>Delete</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>

    <div class="flex flex-col gap-3 p-4">
      <div class="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
        <TemplateIcon templateId={project.templateId} class="size-3.5!" title={templateLabel} />
        <span>{templateLabel}</span>
        <span aria-hidden="true">·</span>
        <span title={calendarDate}>{relativeTime}</span>
      </div>
      <h2 class="line-clamp-2 text-sm font-semibold leading-snug">{project.name}</h2>
    </div>
  </button>
</article>

<style>
  .project-card__thumb {
    min-width: 100%;
    min-height: 100%;
    transform: scale(1.55);
    transform-origin: center center;
  }

  @media (prefers-reduced-motion: reduce) {
    .project-card__thumb {
      transform: scale(1.35);
    }
  }
</style>
