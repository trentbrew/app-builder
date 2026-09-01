<script lang="ts">
  import { page } from '$app/state'
  import { goto, beforeNavigate } from '$app/navigation'
  import { sandboxStore } from '$lib/sandboxStore'
  import { isLeavingEditor, leaveEditor } from '$lib/projects/leaveEditor'
  import { scheduleEditorSave, flushEditorSave, flushAllEditorSaves } from '$lib/editorPersistence'
  import { persistEditorSession } from '$lib/projects/leaveEditor'
  import { browser } from '$app/environment'
  import { onMount, untrack } from 'svelte'
  import EditorDock from '$lib/components/editor-dock.svelte'
  import { clearAppHeader, setAppHeader, type AppHeaderBreadcrumb } from '$lib/appHeader.svelte'
  import { collectFilePaths, getFocusedFilePath, resolveEditorLayout } from '$lib/editorLayout'
  import { isBinaryPreviewPath } from '$lib/fileTypes'
  import { setEditorStatusLeft, editorFileStatusItems, setStatusBarRight } from '$lib/statusBar.svelte'
  import { settings } from '$lib/settings/store.svelte'
  import { getTemplate } from '$lib/projects/templates'
  import { setActiveUserTemplateScope } from '$lib/projects/projectScope'
  import { reloadContainersForProject } from '$lib/containerTabs.svelte'
  import { reloadTabNamesForProject } from '$lib/tabNames.svelte'
  import { fileTreeState } from '$lib/fileTreeState.svelte'
  import type { UserTemplateRecord } from '$lib/projects/types'
  import { userTemplateStore } from '$lib/projects/userTemplateStore'
  import { toast } from '$lib/notify'
  import { hydrateEditorTextFiles } from '$lib/editorFileHydrate'
  import { registerEditorSaveHandler } from '$lib/editorSave'
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'

  const templateId = $derived(page.params.templateId)

  let template = $state<UserTemplateRecord | null>(null)
  let entryPath = $state('/App.svelte')
  let defaultContents = $state('')
  const initialLayout = $derived(resolveEditorLayout([entryPath]))
  const restoredFiles = $derived(collectFilePaths(initialLayout))

  let loading = $state(false)
  let booting = $state(false)
  let error = $state('')
  let bootPhase = $state('idle')
  let openFiles = $state<string[]>([])
  let activeFile = $state('')
  let fileContents = $state<Record<string, string>>({})
  let fsReady = $state(false)
  let hasHydratedAfterBoot = $state(false)
  let editorReady = $state(false)

  function seedEditorState() {
    const startingFiles = restoredFiles.length ? restoredFiles : [entryPath]
    openFiles = startingFiles
    activeFile = getFocusedFilePath(initialLayout) ?? startingFiles[0] ?? entryPath
    fileContents = Object.fromEntries(startingFiles.map((path) => [path, path === entryPath ? defaultContents : '']))
    hasHydratedAfterBoot = false
    editorReady = true
  }

  onMount(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      loading = state.loading
      booting = state.booting
      error = state.error
      bootPhase = state.phase
      fsReady = state.fsReady
    })

    void (async () => {
      const record = await userTemplateStore.get(templateId)
      if (!record) {
        void goto('/templates')
        return
      }
      template = record
      const framework = getTemplate(record.baseTemplateId)
      entryPath = `/${framework.entryFile}`
      defaultContents = framework.defaultAppContents
      setActiveUserTemplateScope(record)
      reloadContainersForProject()
      reloadTabNamesForProject()
      fileTreeState.reloadFromProjectScope()
      seedEditorState()

      if (browser) {
        void sandboxStore.bootUserTemplate?.(templateId)
      }
    })()

    const persistOnHide = () => {
      void persistEditorSession()
    }
    const persistOnVisibility = () => {
      if (document.visibilityState === 'hidden') void persistEditorSession()
    }
    window.addEventListener('pagehide', persistOnHide)
    document.addEventListener('visibilitychange', persistOnVisibility)

    return () => {
      unsubscribe()
      window.removeEventListener('pagehide', persistOnHide)
      document.removeEventListener('visibilitychange', persistOnVisibility)
      void flushAllEditorSaves()
    }
  })

  beforeNavigate(({ to, cancel }) => {
    if (!to || to.url.pathname.startsWith('/editor/')) return
    if (isLeavingEditor()) return

    cancel()
    const href = `${to.url.pathname}${to.url.search}${to.url.hash}`
    void leaveEditor(href)
  })

  const breadcrumbParts = $derived.by(() => {
    const crumbs: AppHeaderBreadcrumb[] = [{ label: 'Templates', href: '/templates' }]
    if (template) {
      crumbs.push({ label: template.name, folderIcon: true })
    }
    if (activeFile) {
      const segments = activeFile.split('/').filter(Boolean)
      for (let i = 0; i < segments.length; i++) {
        const part = segments[i]
        const isLast = i === segments.length - 1
        const isFile = isLast && part.includes('.')
        crumbs.push(isFile ? { label: part, fileIcon: part } : { label: part, folderIcon: true })
      }
    }
    return crumbs
  })

  function handleContentChange(path: string, content: string) {
    if (isBinaryPreviewPath(path)) return
    fileContents = { ...fileContents, [path]: content }
    if (!settings.editor.autoSaveToSandbox) return
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

  $effect(() => {
    if (!editorReady) return
    registerEditorSaveHandler(() => {
      void saveActiveFile()
    })
    return () => registerEditorSaveHandler(null)
  })

  $effect(() => {
    setAppHeader({
      breadcrumb: breadcrumbParts,
    })

    return () => clearAppHeader()
  })

  $effect(() => {
    setEditorStatusLeft({
      phase: bootPhase,
      booting: booting || loading,
      error: error || undefined,
      projectName: template?.name,
    })

    const sandboxItems = [
      {
        id: 'reboot',
        kind: 'button' as const,
        label: 'Reboot',
        title: 'Reboot sandbox',
        icon: RotateCcwIcon,
        onclick: () => sandboxStore.reboot(),
      },
    ]

    setStatusBarRight([...sandboxItems, ...editorFileStatusItems(activeFile)])
  })

  $effect(() => {
    if (!editorReady || !fsReady || hasHydratedAfterBoot) return
    hasHydratedAfterBoot = true
    const paths = openFiles
    untrack(() => {
      void applyHydrate(paths, false)
    })
  })

  $effect(() => {
    if (!editorReady || !fsReady) return
    const paths = openFiles
    untrack(() => {
      void applyHydrate(paths, true)
    })
  })

  async function applyHydrate(paths: string[], onlyEmpty: boolean) {
    const fs = sandboxStore.getFs()
    if (!fs) return

    const result = await hydrateEditorTextFiles(
      fs,
      paths,
      { fileContents, openFiles, activeFile, entryPath },
      onlyEmpty
    )
    if (!result.changed) return
    fileContents = result.fileContents
    openFiles = result.openFiles
    activeFile = result.activeFile
  }
</script>

<div class="relative flex min-h-0 flex-1 flex-col">
  {#if editorReady}
    <EditorDock
      {entryPath}
      {openFiles}
      {fileContents}
      bind:activeFile
      onContentChange={handleContentChange}
      onCloseFile={handleCloseFile}
      onSelectFile={handleFileSelect}
      onRenameFile={handleRenameFile}
    />
  {/if}
</div>
