<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import ProjectCard from '$lib/components/project-card.svelte'
  import ProjectListRow from '$lib/components/project-list-row.svelte'
  import NewProjectDialog from '$lib/components/new-project-dialog.svelte'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import { dexieProjectStore } from '$lib/projects/dexieProjectStore'
  import { getTemplate, TEMPLATE_LIST } from '$lib/projects/templates'
  import type { ProjectRecord } from '$lib/projects/types'
  import { cn } from '$lib/utils.js'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import SearchIcon from '@lucide/svelte/icons/search'
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid'
  import ListIcon from '@lucide/svelte/icons/list'
  import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down'
  import FilterIcon from '@lucide/svelte/icons/filter'
  import StarIcon from '@lucide/svelte/icons/star'
  import BoxesIcon from '@lucide/svelte/icons/boxes'
  import LayersIcon from '@lucide/svelte/icons/layers'
  import MinusIcon from '@lucide/svelte/icons/minus'
  import XIcon from '@lucide/svelte/icons/x'

  type ViewMode = 'grid' | 'list'
  type SortOption = 'lastOpened' | 'name' | 'created' | 'pinned'

  let projects = $state<ProjectRecord[]>([])
  let dialogOpen = $state(false)
  let loading = $state(true)

  let searchQuery = $state('')
  let selectedFramework = $state<string>('all')
  let sortOption = $state<SortOption>('lastOpened')
  let viewMode = $state<ViewMode>('grid')

  const allTemplates = TEMPLATE_LIST

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

  // --- Metrics ---
  const totalProjects = $derived(projects.length)
  const pinnedProjectsCount = $derived(projects.filter((p) => p.pinned).length)
  const uniqueFrameworksCount = $derived(new Set(projects.map((p) => p.templateId)).size)
  const availableTemplatesCount = $derived(allTemplates.length)

  // --- Filter options ---
  const availableFrameworks = $derived.by(() => {
    const map = new Map<string, number>()
    for (const p of projects) {
      const label = getTemplate(p.templateId).label
      map.set(label, (map.get(label) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }))
  })

  // --- Filtered & Sorted Projects ---
  const filteredProjects = $derived.by(() => {
    let result = [...projects]

    // Search query
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query)
        const templateMatch = getTemplate(p.templateId).label.toLowerCase().includes(query)
        return nameMatch || templateMatch
      })
    }

    // Framework filter
    if (selectedFramework !== 'all') {
      result = result.filter((p) => getTemplate(p.templateId).label === selectedFramework)
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOption === 'pinned') {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) {
          return a.pinned ? -1 : 1
        }
        return b.lastOpenedAt - a.lastOpenedAt
      }
      if (sortOption === 'name') {
        return a.name.localeCompare(b.name)
      }
      if (sortOption === 'created') {
        return b.createdAt - a.createdAt
      }
      // default: lastOpened
      return b.lastOpenedAt - a.lastOpenedAt
    })

    return result
  })

  const sortLabels: Record<SortOption, string> = {
    lastOpened: 'Recently edited',
    pinned: 'Starred first',
    name: 'Name (A–Z)',
    created: 'Date created',
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-5 p-6">
  <!-- Header with Title and Metrics Widgets -->
  <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Workspace</h1>
      <p class="text-muted-foreground text-xs">Browse and manage all sandbox projects in your workspace.</p>
    </div>

    <!-- Metric Counter Badges (Trellis Style) -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="bg-card/70 border-border/80 flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-xs">
        <BoxesIcon class="text-primary size-4" />
        <div class="flex flex-col">
          <span class="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Projects</span>
          <span class="text-xs font-semibold tabular-nums">{totalProjects}</span>
        </div>
      </div>

      <div class="bg-card/70 border-border/80 flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-xs">
        <StarIcon class="size-4 text-amber-400 fill-amber-400/20" />
        <div class="flex flex-col">
          <span class="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Starred</span>
          <span class="text-xs font-semibold tabular-nums">{pinnedProjectsCount}</span>
        </div>
      </div>

      <div class="bg-card/70 border-border/80 flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-xs">
        <LayersIcon class="size-4 text-sky-400" />
        <div class="flex flex-col">
          <span class="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Frameworks</span>
          <span class="text-xs font-semibold tabular-nums">{uniqueFrameworksCount}</span>
        </div>
      </div>

      <div class="bg-card/70 border-border/80 flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-xs">
        <div class="size-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <div class="flex flex-col">
          <span class="text-muted-foreground font-mono text-[9px] uppercase tracking-wider">Templates</span>
          <span class="text-xs font-semibold tabular-nums">{availableTemplatesCount}</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Secondary Interactive Toolbar -->
  <section class="bg-card/40 border-border/70 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-2.5 shadow-xs" aria-label="Project search and filters">
    <!-- Left: View Mode Toggle -->
    <div class="bg-muted/60 border-border/60 flex items-center rounded-lg border p-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        class={cn('size-7 rounded-md', viewMode === 'grid' && 'bg-background text-foreground shadow-xs')}
        title="Grid view"
        aria-label="Grid view"
        onclick={() => (viewMode = 'grid')}
      >
        <LayoutGridIcon class="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class={cn('size-7 rounded-md', viewMode === 'list' && 'bg-background text-foreground shadow-xs')}
        title="List view"
        aria-label="List view"
        onclick={() => (viewMode = 'list')}
      >
        <ListIcon class="size-3.5" />
      </Button>
    </div>

    <!-- Center: Full-Width Search Input -->
    <div class="relative flex flex-1 min-w-[200px] items-center">
      <SearchIcon class="text-muted-foreground pointer-events-none absolute left-2.5 size-3.5" />
      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search projects by name or framework…"
        class="bg-muted/50 border-border/70 placeholder:text-muted-foreground/60 focus:bg-background h-8 w-full rounded-lg border pl-8 pr-7 text-xs outline-none transition-colors focus:ring-1 focus:ring-ring"
      />
      {#if searchQuery}
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground absolute right-2 size-4"
          aria-label="Clear search"
          onclick={() => (searchQuery = '')}
        >
          <XIcon class="size-3.5" />
        </button>
      {/if}
    </div>

    <!-- Right: Filter, Sort & New Project -->
    <div class="flex items-center gap-1.5">
      <!-- Framework Filter Dropdown -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 text-xs"
            >
              <FilterIcon class="size-3.5 opacity-70" />
              <span>{selectedFramework === 'all' ? 'All frameworks' : selectedFramework}</span>
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-48">
          <DropdownMenu.Label>Filter Framework</DropdownMenu.Label>
          <DropdownMenu.Item onclick={() => (selectedFramework = 'all')}>
            <span>All frameworks</span>
            <span class="text-muted-foreground ms-auto font-mono text-[10px] tabular-nums">{totalProjects}</span>
          </DropdownMenu.Item>
          {#each availableFrameworks as fw (fw.label)}
            <DropdownMenu.Item onclick={() => (selectedFramework = fw.label)}>
              <span>{fw.label}</span>
              <span class="text-muted-foreground ms-auto font-mono text-[10px] tabular-nums">{fw.count}</span>
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <!-- Sort Dropdown -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 text-xs"
            >
              <ArrowUpDownIcon class="size-3.5 opacity-70" />
              <span>{sortLabels[sortOption]}</span>
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-44">
          <DropdownMenu.Label>Sort By</DropdownMenu.Label>
          <DropdownMenu.Item onclick={() => (sortOption = 'lastOpened')}>Recently edited</DropdownMenu.Item>
          <DropdownMenu.Item onclick={() => (sortOption = 'pinned')}>Starred first</DropdownMenu.Item>
          <DropdownMenu.Item onclick={() => (sortOption = 'name')}>Name (A–Z)</DropdownMenu.Item>
          <DropdownMenu.Item onclick={() => (sortOption = 'created')}>Date created</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <!-- New Project Action -->
      <Button size="sm" class="h-8 gap-1 text-xs" onclick={() => (dialogOpen = true)}>
        <PlusIcon class="size-3.5" />
        New project
      </Button>
    </div>
  </section>

  <!-- Projects Presentation Area -->
  {#if loading}
    <div class="text-muted-foreground flex flex-1 items-center justify-center py-20 text-sm">
      Loading workspace projects…
    </div>
  {:else if filteredProjects.length === 0}
    <div class="bg-card/20 border-border/60 text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
      <div class="bg-muted/40 flex size-12 items-center justify-center rounded-xl border border-border/50">
        <BoxesIcon class="size-6 opacity-60" />
      </div>
      {#if searchQuery || selectedFramework !== 'all'}
        <p class="text-sm font-medium text-foreground">No matching projects found</p>
        <p class="text-xs">Try adjusting your search query or framework filter.</p>
        <Button
          variant="outline"
          size="sm"
          class="mt-2 text-xs"
          onclick={() => {
            searchQuery = ''
            selectedFramework = 'all'
          }}
        >
          Reset filters
        </Button>
      {:else}
        <p class="text-sm font-medium text-foreground">No projects yet</p>
        <p class="text-xs">Create your first sandbox project to get started.</p>
        <Button size="sm" class="mt-2 text-xs" onclick={() => (dialogOpen = true)}>Create your first project</Button>
      {/if}
    </div>
  {:else}
    {#if viewMode === 'grid'}
      <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each filteredProjects as project (project.id)}
          <ProjectCard {project} onRenamed={refresh} onDeleted={refresh} onPinned={refresh} />
        {/each}
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each filteredProjects as project (project.id)}
          <ProjectListRow {project} onRenamed={refresh} onDeleted={refresh} onPinned={refresh} />
        {/each}
      </div>
    {/if}

    <!-- Trellis-style Result Counter Footer -->
    <footer class="text-muted-foreground border-border/40 flex items-center justify-between border-t pt-3 font-mono text-[11px]">
      <span>Showing {filteredProjects.length} of {totalProjects} project{totalProjects === 1 ? '' : 's'}</span>
      {#if searchQuery || selectedFramework !== 'all'}
        <span class="text-primary/90">Filtered by {selectedFramework !== 'all' ? selectedFramework : ''}{searchQuery ? ` "${searchQuery}"` : ''}</span>
      {/if}
    </footer>
  {/if}
</div>

<NewProjectDialog bind:open={dialogOpen} onCreated={handleCreated} />
