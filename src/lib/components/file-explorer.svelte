<script lang="ts">
  import FileTree from '$lib/components/file-tree.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import * as Accordion from '$lib/components/ui/accordion/index.js'
  import { loadProjectTree, type TreeNode } from '$lib/fileTree'
  import { dirname, joinPath } from '$lib/fileTreeOps'
  import {
    collectNodesByPaths,
    filterDotfiles,
    flattenVisibleTree,
    isDotfile,
    parentFolderPath,
    removePathsFromTree,
  } from '$lib/fileTreeView'
  import { fileTreeState } from '$lib/fileTreeState.svelte'
  import { movePath, writeExternalFile } from '$lib/fileOps'
  import { actionRunner } from '$lib/actionRunner.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { isBinaryPreviewPath } from '$lib/fileTypes'
  import { toast } from '$lib/notify'

  let {
    activeFile = '/App.svelte',
    onSelectFile,
    explorer = $bindable(),
  }: {
    activeFile?: string
    onSelectFile?: (path: string, content: string) => void
    explorer?: { createFile: () => void; createFolder: () => void }
  } = $props()

  let tree = $state<TreeNode[]>([])
  let containerReady = $state(false)
  let lastTreeGeneration = $state(-1)
  let bodyEl = $state<HTMLDivElement | undefined>()

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
  const excludedPaths = $derived(new Set([...fileTreeState.pinnedPaths, ...fileTreeState.hiddenPaths]))
  const mainTree = $derived(filterDotfiles(removePathsFromTree(tree, excludedPaths), fileTreeState.showDotfiles))

  const navigableNodes = $derived([
    ...flattenVisibleTree(pinnedNodes, (path) => fileTreeState.isExpanded(path)),
    ...flattenVisibleTree(mainTree, (path) => fileTreeState.isExpanded(path)),
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
    event.dataTransfer.dropEffect = 'copy'
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
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      bind:this={bodyEl}
      class="file-explorer__body"
      tabindex="0"
      role="tree"
      aria-label="Project files"
      onkeydown={handleKeydown}
      ondragover={handleExplorerDragOver}
      ondrop={handleExplorerDrop}
      onclick={() => bodyEl?.focus()}
    >
      {#if !containerReady}
        <p class="text-muted-foreground px-2 py-2 text-xs">Booting project…</p>
      {:else if !tree.length}
        <p class="text-muted-foreground px-2 py-2 text-xs">No files yet.</p>
      {:else}
        {#if pinnedNodes.length}
          <section class="file-explorer__section" aria-label="Pinned files">
            <div class="file-explorer__section-label">Pinned</div>
            <FileTree nodes={pinnedNodes} {activeFile} onSelectFile={openFile} section="pinned" />
          </section>
        {/if}

        <FileTree nodes={mainTree} {activeFile} onSelectFile={openFile} section="main" />

        {#if hiddenNodes.length}
          <Accordion.Root type="single" class="file-explorer__hidden">
            <Accordion.Item value="hidden">
              <Accordion.Trigger class="file-explorer__hidden-trigger">
                Hidden files
                <span class="file-explorer__hidden-count">{hiddenNodes.length}</span>
              </Accordion.Trigger>
              <Accordion.Content>
                <FileTree nodes={hiddenNodes} {activeFile} onSelectFile={openFile} section="hidden" />
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        {/if}
      {/if}
    </div>
  </ContextMenuHost>
</div>

<style>
  .file-explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-background);
    font-size: var(--explorer-font-size);
  }

  :global(.file-explorer__host) {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }

  .file-explorer__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.25rem;
    overscroll-behavior: contain;
    outline: none;
  }

  .file-explorer__section {
    margin-bottom: 0.375rem;
  }

  .file-explorer__section-label {
    padding: 0.125rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.846em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-muted-foreground);
  }

  :global(.file-explorer__hidden) {
    margin-top: 0.375rem;
    border-top: 1px solid var(--color-border);
    padding-top: 0.25rem;
  }

  :global(.file-explorer__hidden-trigger) {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.846em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-muted-foreground);
  }

  .file-explorer__hidden-count {
    font-size: 0.769em;
    opacity: 0.75;
  }
</style>
