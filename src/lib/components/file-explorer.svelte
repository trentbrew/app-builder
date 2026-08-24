<script lang="ts">
  import FileTree from '$lib/components/file-tree.svelte'
  import { loadProjectTree, type TreeNode } from '$lib/fileTree'
  import { dirname, joinPath } from '$lib/fileTreeOps'
  import { sandboxStore } from '$lib/sandboxStore'
  import { toast } from 'svelte-sonner'

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
      createFile: () => void createFile(),
      createFolder: () => void createFolder(),
    }
  })

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
      const content = await fs.readFile(path, 'utf-8')
      onSelectFile(path, content)
    } catch (error) {
      console.error('Error reading file:', error)
    }
  }

  function targetDirectory() {
    return dirname(activeFile)
  }

  async function createFile() {
    const fs = sandboxStore.getFs()
    if (!fs) return

    const name = window.prompt('New file name', 'untitled.md')
    if (!name?.trim()) return

    const path = joinPath(targetDirectory(), name.trim())
    try {
      await fs.writeFile(path, '')
      sandboxStore.notifyFilesystemChange()
      await openFile(path)
      toast.success(`Created ${name.trim()}`)
    } catch {
      toast.error(`Could not create ${name.trim()}`)
    }
  }

  async function createFolder() {
    const fs = sandboxStore.getFs()
    if (!fs) return

    const name = window.prompt('New folder name', 'untitled')
    if (!name?.trim()) return

    const path = joinPath(targetDirectory(), name.trim())
    try {
      await fs.mkdir(path, { recursive: true })
      sandboxStore.notifyFilesystemChange()
      toast.success(`Created folder ${name.trim()}`)
    } catch {
      toast.error(`Could not create folder ${name.trim()}`)
    }
  }
</script>

<div class="file-explorer">
  <div class="file-explorer__body">
    {#if !containerReady}
      <p class="text-muted-foreground px-2 py-2 text-xs">Booting project…</p>
    {:else if tree.length === 0}
      <p class="text-muted-foreground px-2 py-2 text-xs">No files yet.</p>
    {:else}
      <FileTree nodes={tree} {activeFile} onSelectFile={openFile} />
    {/if}
  </div>
</div>

<style>
  .file-explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-background);
  }

  .file-explorer__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.25rem;
    overscroll-behavior: contain;
  }
</style>
