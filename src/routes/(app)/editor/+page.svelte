<script lang="ts">
  import { sandboxStore } from '$lib/sandboxStore'
  import { initialCode } from '$lib/initialCode'
  import { scheduleEditorSave, flushEditorSave } from '$lib/editorPersistence'
  import { browser } from '$app/environment'
  import { onMount, untrack } from 'svelte'
  import EditorDock from '$lib/components/editor-dock.svelte'
  import { clearAppHeader, setAppHeader } from '$lib/appHeader.svelte'
  import { collectFilePaths, getFocusedFilePath, resolveEditorLayout } from '$lib/editorLayout'
  import { isBinaryPreviewPath, isRunnablePath } from '$lib/fileTypes'
  import { setEditorStatus } from '$lib/statusBar.svelte'
  import { toast } from 'svelte-sonner'
  import PlayIcon from '@lucide/svelte/icons/play'
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check'

  const initialPath = '/App.svelte'
  const initialLayout = resolveEditorLayout([initialPath])
  const restoredFiles = collectFilePaths(initialLayout)

  let loading = $state(false)
  let booting = $state(false)
  let error = $state('')
  let previewUrl = $state('')
  let previewPort = $state<number | null>(null)
  let bootPhase = $state('idle')
  const startingFiles = restoredFiles.length ? restoredFiles : [initialPath]
  let openFiles = $state<string[]>(startingFiles)
  let activeFile = $state(getFocusedFilePath(initialLayout) ?? startingFiles[0] ?? initialPath)
  let fileContents = $state<Record<string, string>>(
    Object.fromEntries(startingFiles.map((path) => [path, path === initialPath ? initialCode : ''])),
  )
  let fsReady = $state(false)
  let hasHydratedAfterBoot = $state(false)

  onMount(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      loading = state.loading
      booting = state.booting
      error = state.error
      previewUrl = state.previewUrl
      previewPort = state.previewPort
      bootPhase = state.phase
      fsReady = state.fsReady
    })

    if (browser) {
      void sandboxStore.boot()
    }

    return unsubscribe
  })

  const isRunning = $derived(Boolean(previewUrl) && !booting && !loading && !error)
  const showRunButton = $derived(isRunnablePath(activeFile))

  const runButtonLabel = $derived.by(() => {
    if (!isRunning) return 'Run'
    if (previewPort) return `Running on localhost:${previewPort}`
    try {
      const url = new URL(previewUrl)
      if (url.port) return `Running on localhost:${url.port}`
    } catch {
      // ignore malformed preview URLs
    }
    return 'Running'
  })

  const breadcrumbParts = $derived(
    activeFile
      ? activeFile
          .split('/')
          .filter(Boolean)
          .map((part, index, parts) => ({
            label: part,
            isLast: index === parts.length - 1,
          }))
      : [],
  )

  function handleContentChange(path: string, content: string) {
    if (isBinaryPreviewPath(path)) return
    fileContents = { ...fileContents, [path]: content }
    scheduleEditorSave(path, content, (filePath, fileContent) => sandboxStore.write(filePath, fileContent))
  }

  function handleCloseFile(path: string) {
    const index = openFiles.indexOf(path)
    if (index === -1) return

    const nextOpenFiles = openFiles.filter((filePath) => filePath !== path)
    const { [path]: _, ...remainingContents } = fileContents
    openFiles = nextOpenFiles
    fileContents = remainingContents

    if (activeFile === path) {
      const nextIndex = Math.min(index, nextOpenFiles.length - 1)
      activeFile = nextOpenFiles[nextIndex] ?? ''
    }
  }

  function handleRenameFile(oldPath: string, newPath: string) {
    const nextOpenFiles = openFiles.map((filePath) => (filePath === oldPath ? newPath : filePath))
    const existing = fileContents[oldPath]
    const { [oldPath]: _, ...remainingContents } = fileContents
    openFiles = nextOpenFiles
    fileContents = existing !== undefined ? { ...remainingContents, [newPath]: existing } : remainingContents
    if (activeFile === oldPath) activeFile = newPath
  }

  function handleFileSelect(path: string, content: string) {
    if (!openFiles.includes(path)) {
      openFiles = [...openFiles, path]
    }

    fileContents = { ...fileContents, [path]: content }
    activeFile = path
  }

  async function handleRun() {
    if (!activeFile || isBinaryPreviewPath(activeFile)) return
    await sandboxStore.boot()
    const code = fileContents[activeFile] ?? ''
    const path = activeFile.startsWith('/') ? activeFile : `/${activeFile}`
    await sandboxStore.write(path, code)
  }

  async function saveActiveFile() {
    const path = activeFile
    if (!path || isBinaryPreviewPath(path)) return
    const content = fileContents[path] ?? ''
    try {
      await flushEditorSave(path, content, (filePath, fileContent) => sandboxStore.write(filePath, fileContent))
      toast.success(`Saved ${path.split('/').filter(Boolean).at(-1) ?? path}`)
    } catch {
      toast.error('Could not save file')
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void saveActiveFile()
    }
  }

  $effect(() => {
    setAppHeader({
      breadcrumb: breadcrumbParts.map((part) => ({ label: part.label })),
      actions: [
        {
          id: 'reboot',
          label: 'Reboot',
          variant: 'outline',
          icon: RotateCcwIcon,
          onclick: () => sandboxStore.reboot(),
        },
        ...(showRunButton
          ? [
              {
                id: 'run',
                label: runButtonLabel,
                icon: isRunning ? CircleCheckIcon : PlayIcon,
                disabled: isRunning,
                onclick: () => {
                  void handleRun()
                },
              },
            ]
          : []),
      ],
    })

    return () => clearAppHeader()
  })

  $effect(() => {
    if (booting || loading || !fsReady || hasHydratedAfterBoot) return
    hasHydratedAfterBoot = true
    const paths = openFiles
    untrack(() => {
      void hydrateOpenFiles(paths)
    })
  })

  $effect(() => {
    if (booting || loading || !fsReady) return
    const paths = openFiles
    untrack(() => {
      void hydrateMissingFiles(paths)
    })
  })

  async function hydrateOpenFiles(paths: string[]) {
    const fs = sandboxStore.getFs()
    if (!fs) return

    const next = { ...fileContents }
    let changed = false

    for (const path of paths) {
      if (isBinaryPreviewPath(path)) continue
      try {
        const content = await fs.readFile(normalizeFilePath(path), 'utf-8')
        if (next[path] !== content) {
          next[path] = content
          changed = true
        }
      } catch {
        // File may not exist in the mounted project yet.
      }
    }

    if (changed) fileContents = next
  }

  async function hydrateMissingFiles(paths: string[]) {
    const fs = sandboxStore.getFs()
    if (!fs) return

    const missing = paths.filter((path) => !isBinaryPreviewPath(path) && !(fileContents[path] ?? '').length)
    if (!missing.length) return

    const next = { ...fileContents }
    let changed = false

    for (const path of missing) {
      try {
        next[path] = await fs.readFile(normalizeFilePath(path), 'utf-8')
        changed = true
      } catch {
        // File may not exist in the mounted project yet.
      }
    }

    if (changed) fileContents = next
  }

  function normalizeFilePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`
  }

  $effect(() => {
    setEditorStatus({
      activeFile,
      phase: bootPhase,
      booting: booting || loading,
      error: error || undefined,
    })
  })
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="flex min-h-0 flex-1 flex-col">
  <EditorDock
    {openFiles}
    {fileContents}
    bind:activeFile
    onContentChange={handleContentChange}
    onCloseFile={handleCloseFile}
    onSelectFile={handleFileSelect}
    onRenameFile={handleRenameFile}
  />
</div>
