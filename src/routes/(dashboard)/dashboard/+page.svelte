<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import ProjectCard from '$lib/components/project-card.svelte'
  import NewProjectDialog from '$lib/components/new-project-dialog.svelte'
  import { dexieProjectStore } from '$lib/projects/dexieProjectStore'
  import type { ProjectRecord } from '$lib/projects/types'
  import PlusIcon from '@lucide/svelte/icons/plus'

  let projects = $state<ProjectRecord[]>([])
  let dialogOpen = $state(false)
  let loading = $state(true)

  async function refresh() {
    projects = await dexieProjectStore.list()
  }

  onMount(() => {
    void refresh().finally(() => {
      loading = false
    })
  })

  function handleCreated(projectId: string) {
    void refresh()
    void goto(`/editor/${projectId}`)
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-6 p-6">
  <header class="flex items-center justify-between gap-4">
    <h1 class="text-lg font-semibold">Projects</h1>
    <Button onclick={() => (dialogOpen = true)}>
      <PlusIcon class="size-4" />
      New project
    </Button>
  </header>

  {#if loading}
    <p class="text-muted-foreground text-sm">Loading projects…</p>
  {:else if projects.length === 0}
    <div class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <p class="text-sm">No projects yet</p>
      {#if !dialogOpen}
        <Button onclick={() => (dialogOpen = true)}>Create your first project</Button>
      {/if}
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each projects as project (project.id)}
        <ProjectCard {project} onRenamed={refresh} onDeleted={refresh} onPinned={refresh} />
      {/each}
    </div>
  {/if}
</div>

<NewProjectDialog bind:open={dialogOpen} onCreated={handleCreated} />
