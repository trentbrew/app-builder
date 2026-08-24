<script lang="ts">
  import FileIcon from '$lib/components/file-icon.svelte'
  import FileTreeFolder from '$lib/components/file-tree-folder.svelte'
  import type { TreeNode } from '$lib/fileTree'

  let {
    nodes,
    activeFile,
    onSelectFile,
    depth = 0,
  }: {
    nodes: TreeNode[]
    activeFile: string
    onSelectFile: (path: string) => void
    depth?: number
  } = $props()

  function normalizePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`
  }

  function isActive(path: string) {
    return normalizePath(activeFile) === normalizePath(path)
  }

  function defaultOpen(name: string, nodeDepth: number) {
    return nodeDepth === 0 || ['src', 'lib', 'components', 'routes', 'app'].includes(name)
  }
</script>

<ul class="file-tree-list" class:file-tree-list--nested={depth > 0} role={depth === 0 ? 'tree' : 'group'}>
  {#each nodes as node (node.path)}
    {#if node.kind === 'file'}
      <li role="none">
        <button
          type="button"
          role="treeitem"
          aria-selected={isActive(node.path)}
          class="file-tree-row"
          class:file-tree-row--active={isActive(node.path)}
          onclick={() => onSelectFile(node.path)}
        >
          <FileIcon path={node.path} />
          <span class="file-tree-row__label">{node.name}</span>
        </button>
      </li>
    {:else}
      <li role="none">
        <FileTreeFolder {node} {activeFile} {onSelectFile} {depth} initiallyOpen={defaultOpen(node.name, depth)} />
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

  :global(.file-tree-row) {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-height: 1.625rem;
    padding: 0.125rem 0.375rem;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
    color: var(--color-foreground);
    font: inherit;
    font-size: 0.8125rem;
    line-height: 1.25rem;
    text-align: left;
    cursor: pointer;
  }

  :global(.file-tree-row:hover) {
    background: var(--color-accent);
    color: var(--color-accent-foreground);
  }

  :global(.file-tree-row--active) {
    background: color-mix(in oklch, var(--color-sidebar-primary) 22%, transparent);
    color: var(--color-sidebar-primary-foreground);
  }

  :global(.file-tree-row__label) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.file-tree-row__chevron) {
    opacity: 0.65;
  }
</style>
