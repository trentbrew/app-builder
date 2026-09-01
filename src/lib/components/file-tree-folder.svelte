<script lang="ts">
  import * as Collapsible from '$lib/components/ui/collapsible/index.js'
  import FileIcon from '$lib/components/file-icon.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import FileTreeRowActions from '$lib/components/file-tree-row-actions.svelte'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import PinIcon from '@lucide/svelte/icons/pin'
  import FileTreeBranch from '$lib/components/file-tree.svelte'
  import type { TreeNode } from '$lib/fileTree'
  import { isDotfile, isPinnedTreeDuplicate } from '$lib/fileTreeView'
  import { fileTreeState } from '$lib/fileTreeState.svelte'
  import { movePath } from '$lib/fileOps'
  import { actionRunner } from '$lib/actionRunner.svelte'
  import { sandboxStore } from '$lib/sandboxStore'
  import { explorerDrag } from '$lib/explorerDrag.svelte'
  import { setExplorerDragData } from '$lib/explorerDrag'
  import { cn } from '$lib/utils.js'

  let {
    node,
    activeFile,
    onSelectFile,
    depth,
    initiallyOpen = false,
    forceExpanded = false,
    section = 'main',
  }: {
    node: TreeNode & { kind: 'folder' }
    activeFile: string
    onSelectFile: (path: string) => void
    depth: number
    initiallyOpen?: boolean
    forceExpanded?: boolean
    section?: 'main' | 'pinned' | 'hidden'
  } = $props()

  let open = $state(initiallyOpen)

  $effect(() => {
    if (forceExpanded) {
      open = true
      return
    }
    const mode = fileTreeState.mode
    if (mode === 'expanded') open = true
    else if (mode === 'collapsed') open = false
    else open = fileTreeState.expandedPaths.has(node.path) ? fileTreeState.isExpanded(node.path) : initiallyOpen
  })

  function handleToggle(nextOpen: boolean) {
    open = nextOpen
    fileTreeState.setExpanded(node.path, nextOpen)
  }

  function normalizePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`
  }

  function isActive(path: string) {
    return normalizePath(activeFile) === normalizePath(path)
  }

  function isFocused(path: string) {
    return fileTreeState.focusedPath === normalizePath(path)
  }

  function normalizeTreePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`
  }

  function isDescendantPath(parent: string, child: string) {
    const parentPath = normalizeTreePath(parent)
    const childPath = normalizeTreePath(child)
    return childPath === parentPath || childPath.startsWith(`${parentPath}/`)
  }

  function isPinnedDuplicate(path: string) {
    return isPinnedTreeDuplicate(path, fileTreeState.pinnedPaths, section)
  }

  function handleDragStart(event: DragEvent) {
    if (!event.dataTransfer) return
    setExplorerDragData(event.dataTransfer, node.path)
    explorerDrag.setActivePath(node.path)
  }

  function handleDragEnd() {
    explorerDrag.setActivePath(null)
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    fileTreeState.setDropTarget(node.path)
  }

  function handleDragLeave() {
    if (fileTreeState.dropTargetPath === node.path) fileTreeState.setDropTarget(null)
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    fileTreeState.setDropTarget(null)
    const path = event.dataTransfer?.getData('application/x-app-builder-path')
    if (!path || path === node.path || isDescendantPath(node.path, path)) return
    const fs = sandboxStore.getFs()
    if (!fs) return
    const nextPath = await movePath(fs, path, node.path)
    if (nextPath) {
      fileTreeState.remapPath(path, nextPath)
      actionRunner.renameFile(path, nextPath)
    }
    fileTreeState.setExpanded(node.path, true)
  }
</script>

<Collapsible.Root {open} onOpenChange={handleToggle} class="group/collapsible">
  <Collapsible.Trigger>
    {#snippet child({ props })}
      <ContextMenuHost
        target={{ kind: 'treeNode', path: node.path, nodeKind: 'directory' }}
        triggerClass="file-tree-row-trigger"
      >
        <div
          class="file-tree-row-item"
          class:file-tree-row-item--active={isActive(node.path)}
          class:file-tree-row-item--focused={isFocused(node.path)}
          class:file-tree-row-item--drop-target={fileTreeState.dropTargetPath === node.path}
          class:file-tree-row-item--pinned-duplicate={isPinnedDuplicate(node.path)}
        >
          <button
            type="button"
            {...props}
            role="treeitem"
            aria-expanded={open}
            aria-selected={isActive(node.path)}
            data-tree-path={node.path}
            draggable="true"
            class="file-tree-row file-tree-row--folder"
            class:file-tree-row--dotfile={isDotfile(node.name)}
            class:file-tree-row--pinned={section === 'pinned'}
            onfocus={() => fileTreeState.setFocusedPath(node.path)}
            ondragstart={handleDragStart}
            ondragend={handleDragEnd}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
          >
            <span class="file-tree-row__chevron-slot" aria-hidden="true">
              <ChevronRightIcon
                class={cn(
                  'file-tree-row__chevron size-3.5 transition-transform duration-200',
                  open && 'rotate-90',
                )}
              />
            </span>
            <FileIcon path={node.path} kind="folder" {open} />
            <span class="file-tree-row__label">{node.name}</span>
            {#if fileTreeState.isPinned(node.path) && section !== 'main'}
              <PinIcon class="file-tree-row__pin size-3 shrink-0 opacity-60" />
            {/if}
          </button>
          <FileTreeRowActions path={node.path} {section} />
        </div>
      </ContextMenuHost>
    {/snippet}
  </Collapsible.Trigger>
  <Collapsible.Content ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop}>
    {#if node.children?.length}
      <FileTreeBranch nodes={node.children} {activeFile} {onSelectFile} depth={depth + 1} {forceExpanded} {section} />
    {/if}
  </Collapsible.Content>
</Collapsible.Root>
