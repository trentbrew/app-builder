<script lang="ts">
  import FileTree from '$lib/components/file-tree.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import { loadProjectTree, type TreeNode } from '$lib/fileTree'
  import { dirname, joinPath } from '$lib/fileTreeOps'
  import {
    collectNodesByPaths,
    filterDotfiles,
    filterTreeByQuery,
    flattenVisibleTree,
    isDotfile,
    parentFolderPath,
    projectExplorerMainTree,
  } from '$lib/fileTreeView'
  import { fileTreeState } from '$lib/fileTreeState.svelte'
  import { movePath, writeExternalFile } from '$lib/fileOps'
  import { actionRunner } from '$lib/actionRunner.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { isBinaryPreviewPath } from '$lib/fileTypes'
  import { isExplorerPathDrag } from '$lib/explorerDrag'
  import { toast } from '$lib/notify'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import { cn } from '$lib/utils.js'

  let {
    activeFile = '/App.svelte',
    filterQuery = '',
    onSelectFile,
    explorer = $bindable(),
  }: {
    activeFile?: string
    filterQuery?: string
    onSelectFile?: (path: string, content: string) => void
    explorer?: { createFile: () => void; createFolder: () => void }
  } = $props()

  let tree = $state<TreeNode[]>([])
  let containerReady = $state(false)
  let lastTreeGeneration = $state(-1)
  let bodyEl = $state<HTMLDivElement | undefined>()
  let hiddenOpen = $state(false)

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      containerReady = state.fsReady

      if (state.fsReady && state.treeGeneration !== lastTreeGeneration) {
        lastTreeGeneration = state.treeGeneration
        loadTree().catch(console.error)
      }
    })
    return unsubscribe
  })

  $effect(() => {
    explorer = {
      createFile: () => void createFile(targetDirectory()),
      createFolder: () => void createFolder(targetDirectory()),
    }
  })

  const pinnedNodes = $derived(collectNodesByPaths(tree, fileTreeState.pinnedPaths))
  const hiddenNodes = $derived(collectNodesByPaths(tree, fileTreeState.hiddenPaths))
  const mainTree = $derived(
    filterDotfiles(projectExplorerMainTree(tree, fileTreeState.hiddenPaths), fileTreeState.showDotfiles),
  )
  const filtering = $derived(filterQuery.trim().length > 0)
  const filteredPinnedNodes = $derived(filterTreeByQuery(pinnedNodes, filterQuery))
  const filteredMainTree = $derived(filterTreeByQuery(mainTree, filterQuery))
  const filteredHiddenNodes = $derived(filterTreeByQuery(hiddenNodes, filterQuery))

  const navigableNodes = $derived([
    ...flattenVisibleTree(filteredPinnedNodes, (path) => filtering || fileTreeState.isExpanded(path)),
    ...flattenVisibleTree(filteredMainTree, (path) => filtering || fileTreeState.isExpanded(path)),
  ])

  async function loadTree() {
    const fs = sandboxStore.getFs()
    if (!fs) return

    try {
      tree = await loadProjectTree(fs)
    } catch (error) {
      console.error('Error loading project tree:', error)
    }
  }

  async function openFile(path: string) {
    const fs = sandboxStore.getFs()
    if (!fs || !onSelectFile) return

    try {
      if (isBinaryPreviewPath(path)) {
        onSelectFile(path, '')
        fileTreeState.setFocusedPath(path)
        return
      }
      const content = await fs.readFile(path, 'utf-8')
      onSelectFile(path, content)
      fileTreeState.setFocusedPath(path)
    } catch (error) {
      console.error('Error reading file:', error)
    }
  }

  function targetDirectory() {
    const focused = fileTreeState.focusedPath
    if (focused) {
      const node = [...pinnedNodes, ...hiddenNodes, ...mainTree].find((item) => item.path === focused)
      if (node?.kind === 'directory') return node.path
      return dirname(focused)
    }
    return dirname(activeFile)
  }

  async function createFile(dir = targetDirectory()) {
    const fs = sandboxStore.getFs()
    if (!fs) return

    const name = window.prompt('New file name', 'untitled.md')
    if (!name?.trim()) return

    const path = joinPath(dir, name.trim())
    try {
      await fs.writeFile(path, '')
      sandboxStore.notifyFilesystemChange()
      await openFile(path)
      toast.success(`Created ${name.trim()}`)
    } catch {
      toast.error(`Could not create ${name.trim()}`)
    }
  }

  async function createFolder(dir = targetDirectory()) {
    const fs = sandboxStore.getFs()
    if (!fs) return

    const name = window.prompt('New folder name', 'untitled')
    if (!name?.trim()) return

    const path = joinPath(dir, name.trim())
    try {
      await fs.mkdir(path, { recursive: true })
      sandboxStore.notifyFilesystemChange()
      toast.success(`Created folder ${name.trim()}`)
    } catch {
      toast.error(`Could not create folder ${name.trim()}`)
    }
  }

  async function handleInternalDrop(path: string, targetDir: string) {
    const fs = sandboxStore.getFs()
    if (!fs) return
    const parent = parentFolderPath(path)
    if (!parent || parent === targetDir) return
    const nextPath = await movePath(fs, path, targetDir)
    if (!nextPath) return
    fileTreeState.remapPath(path, nextPath)
    actionRunner.renameFile(path, nextPath)
    toast.success(`Moved ${path.split('/').pop()}`)
  }

  async function handleExternalDrop(event: DragEvent, targetDir: string) {
    const fs = sandboxStore.getFs()
    if (!fs || !event.dataTransfer?.files?.length) return

    for (const file of [...event.dataTransfer.files]) {
      await writeExternalFile(fs, targetDir, file)
    }
    toast.success(`Imported ${event.dataTransfer.files.length} file(s)`)
  }

  function handleExplorerDragOver(event: DragEvent) {
    if (!event.dataTransfer) return
    event.preventDefault()
    event.dataTransfer.dropEffect = isExplorerPathDrag(event.dataTransfer) ? 'move' : 'copy'
  }

  async function handleExplorerDrop(event: DragEvent) {
    event.preventDefault()
    fileTreeState.setDropTarget(null)
    const dir = targetDirectory()
    if (event.dataTransfer?.types.includes('application/x-app-builder-path')) {
      const path = event.dataTransfer.getData('application/x-app-builder-path')
      if (path) await handleInternalDrop(path, dir)
      return
    }
    await handleExternalDrop(event, dir)
  }

  function focusNodeAt(index: number) {
    const node = navigableNodes[index]
    if (!node) return
    fileTreeState.setFocusedPath(node.path)
    bodyEl?.querySelector(`[data-tree-path="${CSS.escape(node.path)}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!navigableNodes.length) return

    const currentIndex = navigableNodes.findIndex((node) => node.path === fileTreeState.focusedPath)
    const index = currentIndex >= 0 ? currentIndex : 0
    const current = navigableNodes[index]

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusNodeAt(Math.min(index + 1, navigableNodes.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusNodeAt(Math.max(index - 1, 0))
    } else if (event.key === 'ArrowRight' && current?.kind === 'folder') {
      event.preventDefault()
      fileTreeState.setExpanded(current.path, true)
    } else if (event.key === 'ArrowLeft' && current) {
      event.preventDefault()
      if (current.kind === 'folder' && fileTreeState.isExpanded(current.path)) {
        fileTreeState.setExpanded(current.path, false)
      } else {
        const parent = parentFolderPath(current.path)
        if (parent) fileTreeState.setFocusedPath(parent)
      }
    } else if (event.key === 'Enter' && current?.kind === 'file') {
      event.preventDefault()
      void openFile(current.path)
    }
  }

  $effect(() => {
    if (!fileTreeState.focusedPath && navigableNodes.length) {
      fileTreeState.setFocusedPath(activeFile)
    }
  })
</script>

<div class="file-explorer">
  <ContextMenuHost target={{ kind: 'explorer' }} triggerClass="file-explorer__host">
    <div class="file-explorer__layout">
      {#if !containerReady}
        <p class="file-explorer__empty text-muted-foreground px-2 py-2 text-xs">Booting project…</p>
      {:else if !tree.length}
        <p class="file-explorer__empty text-muted-foreground px-2 py-2 text-xs">No files yet.</p>
      {:else if !filteredPinnedNodes.length && !filteredMainTree.length && !filteredHiddenNodes.length}
        <p class="file-explorer__empty text-muted-foreground px-2 py-2 text-xs">
          {filtering ? 'No files match your filter.' : 'No files yet.'}
        </p>
      {:else}
        {#if filteredPinnedNodes.length}
          <section class="file-explorer__pinned" aria-label="Pinned files">
            <button
              type="button"
              class="file-explorer__section-trigger"
              aria-expanded={fileTreeState.shortcutsPanelOpen}
              onclick={() => fileTreeState.setShortcutsPanelOpen(!fileTreeState.shortcutsPanelOpen)}
            >
              <span class="file-explorer__section-chevron-slot" aria-hidden="true">
                <ChevronRightIcon
                  class={cn(
                    'file-explorer__section-chevron size-3.5 transition-transform duration-200',
                    fileTreeState.shortcutsPanelOpen && 'rotate-90',
                  )}
                />
              </span>
              <span>Pinned</span>
              <span class="file-explorer__section-count">{filteredPinnedNodes.length}</span>
            </button>
            {#if fileTreeState.shortcutsPanelOpen}
              <div class="file-explorer__pinned-panel">
                <FileTree
                  nodes={filteredPinnedNodes}
                  {activeFile}
                  onSelectFile={openFile}
                  section="pinned"
                  forceExpanded={filtering}
                />
              </div>
            {/if}
          </section>
        {/if}

        <section class="file-explorer__main" aria-label="Project files">
          <button
            type="button"
            class="file-explorer__section-trigger"
            aria-expanded={fileTreeState.mainPanelOpen}
            onclick={() => fileTreeState.setMainPanelOpen(!fileTreeState.mainPanelOpen)}
          >
            <span class="file-explorer__section-chevron-slot" aria-hidden="true">
              <ChevronRightIcon
                class={cn(
                  'file-explorer__section-chevron size-3.5 transition-transform duration-200',
                  fileTreeState.mainPanelOpen && 'rotate-90',
                )}
              />
            </span>
            <span>Files</span>
            <span class="file-explorer__section-count">{filteredMainTree.length}</span>
          </button>
          {#if fileTreeState.mainPanelOpen}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              bind:this={bodyEl}
              class="file-explorer__scroll"
              tabindex="0"
              role="tree"
              aria-label="Project files"
              onkeydown={handleKeydown}
              ondragover={handleExplorerDragOver}
              ondrop={handleExplorerDrop}
              onclick={() => bodyEl?.focus()}
            >
              <FileTree
                nodes={filteredMainTree}
                {activeFile}
                onSelectFile={openFile}
                section="main"
                forceExpanded={filtering}
              />
            </div>
          {/if}
        </section>

        {#if filteredHiddenNodes.length}
          <footer class="file-explorer__footer">
            <button
              type="button"
              class="file-explorer__section-trigger file-explorer__hidden-trigger"
              aria-expanded={hiddenOpen}
              onclick={() => (hiddenOpen = !hiddenOpen)}
            >
              <span class="file-explorer__section-chevron-slot" aria-hidden="true">
                <ChevronRightIcon
                  class={cn(
                    'file-explorer__section-chevron size-3.5 transition-transform duration-200',
                    hiddenOpen && 'rotate-90',
                  )}
                />
              </span>
              <span>Hidden files</span>
              <span class="file-explorer__section-count">{filteredHiddenNodes.length}</span>
            </button>
            {#if hiddenOpen}
              <div class="file-explorer__hidden-panel">
                <FileTree
                  nodes={filteredHiddenNodes}
                  {activeFile}
                  onSelectFile={openFile}
                  section="hidden"
                  forceExpanded={filtering}
                />
              </div>
            {/if}
          </footer>
        {/if}
      {/if}
    </div>
  </ContextMenuHost>
</div>

<style>
  .file-explorer {
    --file-explorer-row-pad-x: 0.5rem;
    --file-explorer-chevron-size: 0.875rem;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-chrome-surface);
    font-size: var(--explorer-font-size);
  }

  :global(.file-explorer__host) {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }

  .file-explorer__layout {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .file-explorer__empty {
    flex-shrink: 0;
    padding: 0.25rem;
  }

  .file-explorer__pinned {
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }

  .file-explorer__pinned-panel {
    padding-bottom: 0.25rem;
  }

  .file-explorer__main {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .file-explorer__scroll {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    outline: none;
  }

  .file-explorer__section-trigger {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem var(--file-explorer-row-pad-x);
    border: none;
    border-radius: 0;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 0.846em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-muted-foreground);
    cursor: pointer;
    text-decoration: none;
  }

  .file-explorer__section-trigger:hover {
    background: var(--color-accent);
    color: var(--color-accent-foreground);
  }

  .file-explorer__section-chevron-slot {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--file-explorer-chevron-size);
    height: var(--file-explorer-chevron-size);
  }

  .file-explorer__section-count {
    margin-left: auto;
    font-size: 0.769em;
    opacity: 0.75;
  }

  .file-explorer__footer {
    flex-shrink: 0;
    margin-top: auto;
    border-top: 1px solid var(--color-border);
    background: var(--color-chrome-surface);
  }

  .file-explorer__hidden-trigger {
    border-radius: 0;
  }

  .file-explorer__hidden-panel {
    max-height: min(40vh, 280px);
    overflow-y: auto;
  }
</style>
