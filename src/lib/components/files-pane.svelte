<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import FileExplorer from '$lib/components/file-explorer.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { fileTreeState } from '$lib/fileTreeState.svelte'
  import ChevronsDownUpIcon from '@lucide/svelte/icons/chevrons-down-up'
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import FilePlusIcon from '@lucide/svelte/icons/file-plus'
  import FolderPlusIcon from '@lucide/svelte/icons/folder-plus'
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'

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
</script>

<PaneChrome>
  {#snippet toolbar()}
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
          title="New file"
          aria-label="New file"
          disabled={!fsReady}
          onclick={() => explorer?.createFile()}
        >
          <FilePlusIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class="pane-toolbar__btn"
          title="New folder"
          aria-label="New folder"
          disabled={!fsReady}
          onclick={() => explorer?.createFolder()}
        >
          <FolderPlusIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Expand all folders"
          aria-label="Expand all folders"
          disabled={!fsReady}
          onclick={() => fileTreeState.expandAll()}
        >
          <ChevronsUpDownIcon class="size-3.5" />
        </button>
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Collapse all folders"
          aria-label="Collapse all folders"
          disabled={!fsReady}
          onclick={() => fileTreeState.collapseAll()}
        >
          <ChevronsDownUpIcon class="size-3.5" />
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
  {/snippet}

  {#snippet children()}
    <FileExplorer bind:explorer {activeFile} {onSelectFile} />
  {/snippet}
</PaneChrome>
