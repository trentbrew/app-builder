<script lang="ts">
  import FileIcon from '$lib/components/file-icon.svelte'
  import FileTreeFolder from '$lib/components/file-tree-folder.svelte'
  import FileTreeRowActions from '$lib/components/file-tree-row-actions.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import type { TreeNode } from '$lib/fileTree'
  import { fileTreeState } from '$lib/fileTreeState.svelte'
  import { explorerDrag } from '$lib/explorerDrag.svelte'
  import { setExplorerDragData } from '$lib/explorerDrag'
  import { isDotfile, isPinnedTreeDuplicate } from '$lib/fileTreeView'

  let {
    nodes,
    activeFile,
    onSelectFile,
    depth = 0,
    forceExpanded = false,
    section = 'main',
  }: {
    nodes: TreeNode[]
    activeFile: string
    onSelectFile: (path: string) => void
    depth?: number
    forceExpanded?: boolean
    section?: 'main' | 'pinned' | 'hidden'
  } = $props()

  function normalizePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`
  }

  function isActive(path: string) {
    return normalizePath(activeFile) === normalizePath(path)
  }

  function isFocused(path: string) {
    return fileTreeState.focusedPath === normalizePath(path)
  }

  function defaultOpen(name: string, nodeDepth: number) {
    return nodeDepth === 0 || ['src', 'lib', 'components', 'routes', 'app'].includes(name)
  }

  function handleDragStart(event: DragEvent, path: string) {
    if (!event.dataTransfer) return
    setExplorerDragData(event.dataTransfer, path)
    explorerDrag.setActivePath(path)
  }

  function isPinnedDuplicate(path: string) {
    return isPinnedTreeDuplicate(path, fileTreeState.pinnedPaths, section)
  }

  function handleDragEnd() {
    explorerDrag.setActivePath(null)
  }
</script>

<ul class="file-tree-list" class:file-tree-list--nested={depth > 0} role={depth === 0 ? 'tree' : 'group'}>
  {#each nodes as node (node.path)}
    {#if node.kind === 'file'}
      <li role="none">
        <ContextMenuHost
          target={{ kind: 'treeNode', path: node.path, nodeKind: 'file' }}
          triggerClass="file-tree-row-trigger"
        >
          <div
            class="file-tree-row-item"
            class:file-tree-row-item--active={isActive(node.path)}
            class:file-tree-row-item--focused={isFocused(node.path)}
            class:file-tree-row-item--pinned-duplicate={isPinnedDuplicate(node.path)}
          >
            <button
              type="button"
              role="treeitem"
              aria-selected={isActive(node.path)}
              data-tree-path={node.path}
              draggable="true"
              class="file-tree-row"
              class:file-tree-row--dotfile={isDotfile(node.name)}
              class:file-tree-row--pinned={section === 'pinned'}
              onfocus={() => fileTreeState.setFocusedPath(node.path)}
              ondragstart={(event) => handleDragStart(event, node.path)}
              ondragend={handleDragEnd}
              onclick={() => onSelectFile(node.path)}
            >
              <span class="file-tree-row__chevron-slot" aria-hidden="true"></span>
              <FileIcon path={node.path} />
              <span class="file-tree-row__label">{node.name}</span>
            </button>
            <FileTreeRowActions path={node.path} {section} />
          </div>
        </ContextMenuHost>
      </li>
    {:else}
      <li role="none">
        <FileTreeFolder
          {node}
          {activeFile}
          {onSelectFile}
          {depth}
          {forceExpanded}
          {section}
          initiallyOpen={defaultOpen(node.name, depth)}
        />
      </li>
    {/if}
  {/each}
</ul>

<style>
  .file-tree-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .file-tree-list--nested {
    margin-left: 0.75rem;
    border-left: 1px solid var(--color-border);
    padding-left: 0.125rem;
  }

  :global(.file-tree-row-trigger) {
    display: block;
    width: 100%;
  }

  :global(.file-tree-row-item) {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    padding: 0.125rem var(--file-explorer-row-pad-x, 0.5rem);
    border-radius: 0;
    color: var(--color-foreground);
  }

  :global(.file-tree-row-item:hover),
  :global(.file-tree-row-item:focus-within) {
    background: var(--color-accent);
    color: var(--color-accent-foreground);
  }

  :global(.file-tree-row-item--active) {
    background: color-mix(in oklch, var(--editor-tab-active-accent, var(--color-primary)) 22%, transparent);
    color: var(--color-foreground);
  }

  :global(.light .file-tree-row-item--active) {
    background: color-mix(in oklch, var(--editor-tab-active-accent, var(--color-primary)) 16%, var(--color-muted));
  }

  :global(.file-tree-row-item--active:hover),
  :global(.file-tree-row-item--active:focus-within) {
    color: var(--color-foreground);
  }

  :global(.file-tree-row-item--pinned-duplicate) {
    opacity: 0.5;
  }

  :global(.file-tree-row-item--pinned-duplicate:hover),
  :global(.file-tree-row-item--pinned-duplicate:focus-within) {
    opacity: 0.72;
  }

  :global(.file-tree-row) {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex: 1 1 0;
    min-width: 0;
    min-height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 1em;
    line-height: 1.25rem;
    text-align: left;
    cursor: pointer;
  }

  :global(.file-tree-row--drop-target) {
    outline: none;
  }

  :global(.file-tree-row-item--drop-target) {
    outline: 1px solid color-mix(in oklch, var(--color-primary) 55%, transparent);
    outline-offset: -1px;
    background: color-mix(in oklch, var(--color-primary) 12%, transparent);
  }

  :global(.file-tree-row__label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.file-tree-row__chevron-slot) {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--file-explorer-chevron-size, 0.875rem);
    height: var(--file-explorer-chevron-size, 0.875rem);
  }

  :global(.file-tree-row__chevron) {
    opacity: 0.65;
  }

  :global(.file-tree-row__actions) {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    pointer-events: none;
  }

  :global(.file-tree-row__action-btn) {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--color-muted-foreground);
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
  }

  :global(.file-tree-row-item:hover .file-tree-row__action-btn),
  :global(.file-tree-row-item:focus-within .file-tree-row__action-btn),
  :global(.file-tree-row__action-btn--active) {
    opacity: 0.65;
    pointer-events: auto;
  }

  :global(.file-tree-row__action-btn--active),
  :global(.file-tree-row__action-btn:hover) {
    opacity: 1;
    color: var(--color-foreground);
    background: color-mix(in oklch, var(--color-foreground) 10%, transparent);
  }

  :global(.file-tree-row__pin-btn:hover),
  :global(.file-tree-row__pin-btn.file-tree-row__action-btn--active) {
    background: transparent;
  }
</style>
