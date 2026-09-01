<script lang="ts">
  import { goto } from '$app/navigation'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import TemplateIcon from '$lib/components/template-icon.svelte'
  import { getTemplate } from '$lib/projects/templates'
  import type { ProjectRecord } from '$lib/projects/types'
  import { dexieProjectStore } from '$lib/projects/dexieProjectStore'
  import { userTemplateStore } from '$lib/projects/userTemplateStore'
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

  let pinned = $state(Boolean(project.pinned))

  const templateLabel = $derived(getTemplate(project.templateId).label)
  const relativeTime = $derived(formatRelative(project.lastOpenedAt))
  const calendarDate = $derived(formatCalendarDate(project.lastOpenedAt))

  $effect(() => {
    pinned = Boolean(project.pinned)
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

<div
  class={cn(
    'group border-border bg-card/60 hover:bg-muted/40 flex items-center justify-between gap-4 rounded-lg border px-3.5 py-2.5 transition-colors',
    pinned && 'border-primary/30 bg-primary/[0.03]',
  )}
>
  <button
    type="button"
    class="flex flex-1 min-w-0 items-center gap-3 text-left"
    onclick={openProject}
  >
    <div class="bg-muted/60 flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60">
      <TemplateIcon templateId={project.templateId} class="size-4!" title={templateLabel} />
    </div>

    <div class="flex flex-1 min-w-0 flex-col gap-0.5">
      <div class="flex items-center gap-2">
        <span class="truncate text-sm font-medium leading-snug group-hover:text-primary transition-colors">
          {project.name}
        </span>
        {#if pinned}
          <StarIcon class="size-3 shrink-0 fill-amber-400 text-amber-400" />
        {/if}
      </div>
      <div class="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
        <span>{templateLabel}</span>
        <span aria-hidden="true">·</span>
        <span title={calendarDate}>{relativeTime}</span>
      </div>
    </div>
  </button>

  <div class="flex shrink-0 items-center gap-1">
    <Button
      variant="ghost"
      size="icon-sm"
      class={cn('text-muted-foreground hover:text-foreground', pinned && 'text-amber-400 hover:text-amber-400')}
      aria-label={pinned ? 'Unpin project' : 'Pin project'}
      aria-pressed={pinned}
      onclick={handleTogglePin}
    >
      <StarIcon class={cn('size-3.5', pinned && 'fill-current')} />
    </Button>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-foreground"
            aria-label="Project actions"
            onclick={(event) => event.stopPropagation()}
          >
            <MoreHorizontalIcon class="size-3.5" />
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
