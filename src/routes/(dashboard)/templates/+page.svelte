<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import TemplateCard from '$lib/components/template-card.svelte'
  import NewTemplateDialog from '$lib/components/new-template-dialog.svelte'
  import NewProjectDialog from '$lib/components/new-project-dialog.svelte'
  import { userTemplateStore } from '$lib/projects/userTemplateStore'
  import type { UserTemplateRecord } from '$lib/projects/types'
  import PlusIcon from '@lucide/svelte/icons/plus'

  let templates = $state<UserTemplateRecord[]>([])
  let templateDialogOpen = $state(false)
  let projectDialogOpen = $state(false)
  let selectedTemplateId = $state<string | null>(null)
  let loading = $state(true)

  async function refresh() {
    templates = await userTemplateStore.list()
  }

  onMount(() => {
    void refresh().finally(() => {
      loading = false
    })
  })

  function handleTemplateCreated(templateId: string) {
    void refresh()
    void goto(`/editor/template/${templateId}`)
  }

  function handleOpenTemplate(templateId: string) {
    void goto(`/editor/template/${templateId}`)
  }

  function handleUseTemplate(templateId: string) {
    selectedTemplateId = templateId
    projectDialogOpen = true
  }

  function handleProjectCreated(projectId: string) {
    selectedTemplateId = null
    void refresh()
    void goto(`/editor/${projectId}`)
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 p-6">
  <header class="flex items-center justify-between gap-4">
    <h1 class="text-lg font-semibold">Templates</h1>
    <Button onclick={() => (templateDialogOpen = true)}>
      <PlusIcon class="size-4" />
      New template
    </Button>
  </header>

  {#if loading}
    <p class="text-muted-foreground text-sm">Loading templates…</p>
  {:else if templates.length === 0}
    <div class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <p class="text-sm">No templates yet</p>
      <p class="max-w-sm text-xs">Create a starter from a framework, then customize it in the editor.</p>
      {#if !templateDialogOpen}
        <Button onclick={() => (templateDialogOpen = true)}>Create your first template</Button>
      {/if}
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each templates as template (template.id)}
        <TemplateCard
          {template}
          onRenamed={refresh}
          onDeleted={refresh}
          onOpen={handleOpenTemplate}
          onUse={handleUseTemplate}
        />
      {/each}
    </div>
  {/if}
</div>

<NewTemplateDialog bind:open={templateDialogOpen} onCreated={handleTemplateCreated} />
<NewProjectDialog bind:open={projectDialogOpen} userTemplateId={selectedTemplateId} onCreated={handleProjectCreated} />
