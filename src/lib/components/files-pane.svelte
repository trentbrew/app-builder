<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import FileExplorer from '$lib/components/file-explorer.svelte'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import { sandboxStore } from '$lib/sandboxStore'
  import { fileTreeState } from '$lib/fileTreeState.svelte'
  import ChevronsDownUpIcon from '@lucide/svelte/icons/chevrons-down-up'
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import FilePlusIcon from '@lucide/svelte/icons/file-plus'
  import FolderPlusIcon from '@lucide/svelte/icons/folder-plus'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
  import SearchIcon from '@lucide/svelte/icons/search'
  import XIcon from '@lucide/svelte/icons/x'

  let {
    activeFile = '/App.svelte',
    canSplit = false,
    maximized = false,
    onSelectFile,
    onSplit,
    onToggleMaximize,
  }: {
    activeFile?: string
    canSplit?: boolean
    maximized?: boolean
    onSelectFile?: (path: string, content: string) => void
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
    onToggleMaximize?: () => void
  } = $props()

  let fsReady = $state(false)
  let backend = $state<'bun' | 'webcontainer' | 'unknown'>('unknown')
  let explorer = $state<{ createFile: () => void; createFolder: () => void } | undefined>()
  let searchOpen = $state(false)
  let searchQuery = $state('')
  let searchInput = $state<HTMLInputElement | undefined>()

  const allExpanded = $derived(fileTreeState.mode === 'expanded')

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      fsReady = state.fsReady
      backend = state.backend
    })
    return unsubscribe
  })

  function refreshTree() {
    sandboxStore.notifyFilesystemChange()
  }

  function toggleExpandAll() {
    if (allExpanded) fileTreeState.collapseAll()
    else fileTreeState.expandAll()
  }

  function openSearch() {
    searchOpen = true
    queueMicrotask(() => searchInput?.focus())
  }

  function closeSearch() {
    searchOpen = false
    searchQuery = ''
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
    }
  }
</script>

<PaneChrome surface="chrome">
  {#snippet toolbar()}
    <div class="files-pane__toolbar">
      <PaneToolbar>
        {#snippet meta()}
          <span class="pane-toolbar__detail">
            {#if fsReady}
              {backend === 'bun' ? 'Bun sandbox' : 'WebContainer'}
            {:else}
              Booting…
            {/if}
          </span>
        {/snippet}

        {#snippet actions()}
        <button
          type="button"
          class="pane-toolbar__btn"
          class:pane-toolbar__btn--active={searchOpen}
          title="Filter files"
          aria-label="Filter files"
          disabled={!fsReady}
          onclick={() => (searchOpen ? closeSearch() : openSearch())}
        >
          <SearchIcon class="size-3.5" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                type="button"
                class="pane-toolbar__btn"
                title="New file or folder"
                aria-label="New file or folder"
                disabled={!fsReady}
              >
                <PlusIcon class="size-3.5" />
              </button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-40">
            <DropdownMenu.Item disabled={!fsReady} onclick={() => explorer?.createFile()}>
              <FilePlusIcon class="size-3.5" />
              New file
            </DropdownMenu.Item>
            <DropdownMenu.Item disabled={!fsReady} onclick={() => explorer?.createFolder()}>
              <FolderPlusIcon class="size-3.5" />
              New folder
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <button
          type="button"
          class="pane-toolbar__btn"
          class:pane-toolbar__btn--active={allExpanded}
          title={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
          aria-label={allExpanded ? 'Collapse all folders' : 'Expand all folders'}
          disabled={!fsReady}
          onclick={toggleExpandAll}
        >
          {#if allExpanded}
            <ChevronsDownUpIcon class="size-3.5" />
          {:else}
            <ChevronsUpDownIcon class="size-3.5" />
          {/if}
        </button>

        <button
          type="button"
          class="pane-toolbar__btn"
          title="Refresh file tree"
          aria-label="Refresh file tree"
          disabled={!fsReady}
          onclick={refreshTree}
        >
          <RefreshCwIcon class="size-3.5" />
        </button>
        <PaneMaximizeButton {maximized} onToggle={onToggleMaximize} />
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
        {/snippet}
      </PaneToolbar>

      {#if searchOpen}
        <div class="files-pane__search-row">
          <div class="files-pane__search">
            <SearchIcon class="files-pane__search-icon size-3.5 shrink-0 opacity-60" />
            <input
              bind:this={searchInput}
              bind:value={searchQuery}
              type="search"
              class="files-pane__search-input"
              placeholder="Filter files…"
              aria-label="Filter files"
              onkeydown={handleSearchKeydown}
            />
            <button
              type="button"
              class="pane-toolbar__btn files-pane__search-close"
              title="Close filter"
              aria-label="Close filter"
              onclick={closeSearch}
            >
              <XIcon class="size-3" />
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet children()}
    <FileExplorer bind:explorer {activeFile} filterQuery={searchQuery} {onSelectFile} />
  {/snippet}
</PaneChrome>

<style>
  .files-pane__toolbar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-chrome-surface);
  }

  .files-pane__toolbar :global(.pane-toolbar) {
    border-bottom: none;
    background: transparent;
  }

  .files-pane__search-row {
    display: flex;
    align-items: center;
    padding: 0 0.5rem 0.375rem;
  }

  .files-pane__search {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-width: 0;
  }

  .files-pane__search-input {
    flex: 1 1 auto;
    min-width: 0;
    height: 1.5rem;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    background: color-mix(in oklch, var(--color-muted) 45%, transparent);
    color: var(--color-foreground);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    padding: 0 0.375rem;
    outline: none;
  }

  .files-pane__search-input:focus {
    background: color-mix(in oklch, var(--color-muted) 65%, transparent);
  }

  .files-pane__search-input::placeholder {
    color: var(--color-muted-foreground);
  }

  .files-pane__search-close {
    width: 1.375rem;
    height: 1.375rem;
    flex-shrink: 0;
  }
</style>
