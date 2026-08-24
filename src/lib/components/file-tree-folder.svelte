<script lang="ts">
  import * as Collapsible from '$lib/components/ui/collapsible/index.js'
  import FileIcon from '$lib/components/file-icon.svelte'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import FileTreeBranch from '$lib/components/file-tree.svelte'
  import type { TreeNode } from '$lib/fileTree'
  import { fileTreeState } from '$lib/fileTreeState.svelte'

  let {
    node,
    activeFile,
    onSelectFile,
    depth,
    initiallyOpen = false,
  }: {
    node: TreeNode & { kind: 'folder' }
    activeFile: string
    onSelectFile: (path: string) => void
    depth: number
    initiallyOpen?: boolean
  } = $props()

  let open = $state(initiallyOpen)

  $effect(() => {
    const mode = fileTreeState.mode
    if (mode === 'expanded') open = true
    else if (mode === 'collapsed') open = false
  })

  function handleToggle(nextOpen: boolean) {
    open = nextOpen
    if (fileTreeState.mode !== 'default') fileTreeState.reset()
  }

  function normalizePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`
  }

  function isActive(path: string) {
    return normalizePath(activeFile) === normalizePath(path)
  }
</script>

<Collapsible.Root open={open} onOpenChange={handleToggle} class="group/collapsible">
  <Collapsible.Trigger>
    {#snippet child({ props })}
      <button
        type="button"
        {...props}
        role="treeitem"
        aria-expanded={open}
        aria-selected={isActive(node.path)}
        class="file-tree-row file-tree-row--folder"
        class:file-tree-row--active={isActive(node.path)}
      >
        <ChevronRightIcon
          class="file-tree-row__chevron size-3.5 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90"
        />
        <FileIcon path={node.path} kind="folder" {open} />
        <span class="file-tree-row__label">{node.name}</span>
      </button>
    {/snippet}
  </Collapsible.Trigger>
  <Collapsible.Content>
    {#if node.children?.length}
      <FileTreeBranch nodes={node.children} {activeFile} {onSelectFile} depth={depth + 1} />
    {/if}
  </Collapsible.Content>
</Collapsible.Root>
