<script lang="ts">
  import { HorizonLayout, type LayoutConfig, type View } from 'horizon-layout'
  import { SvelteMap } from 'svelte/reactivity'
  import { createRawSnippet, mount, unmount, untrack, type Snippet } from 'svelte'
  import FilePane from '$lib/components/file-pane.svelte'
  import TerminalPane from '$lib/components/terminal-pane.svelte'
  import EmptyPane from '$lib/components/empty-pane.svelte'
  import ExplorerWorkspaceDrop from '$lib/components/explorer-workspace-drop.svelte'
  import FileIcon from '$lib/components/file-icon.svelte'
  import XIcon from '@lucide/svelte/icons/x'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import TerminalSquareIcon from '@lucide/svelte/icons/terminal'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import type { ActionTarget } from '$lib/actionContext'
  import { actionRunner } from '$lib/actionRunner.svelte'
  import { createDockLayoutHandle, resolveActiveTabIdFromElement } from '$lib/layoutKeyboard'
  import { setLayoutHandle } from '$lib/layoutHandle'
  import { sandboxStore } from '$lib/sandboxStore'
  import {
    EMPTY_PANE_VIEW_ID,
    addFileToLayout,
    addTerminalToLayout,
    collectFilePaths,
    collectTerminalSessionIds,
    createTerminalSessionId,
    fileViewId,
    insertFileIntoEmptyPane,
    openFileAtPaneDrop,
    isFileViewId,
    isTerminalViewId,
    pathFromFileViewId,
    removeFileFromLayout,
    removeTerminalFromLayout,
    resolveActiveTabInLayout,
    sessionIdFromTerminalViewId,
    splitViewInLayout,
    tabGroupHasMultipleTabs,
    terminalViewId,
    toggleMaximizedView,
  } from '$lib/editorLayout'
  import { createFileInDirectory, openFileFromFs } from '$lib/fileOps'
  import { dirname } from '$lib/fileTreeOps'
  import { basename } from '$lib/fileIcons'
  import { getTabTitle, getTabName, setTabName, tabNames } from '$lib/tabNames.svelte'
  import { disposeTerminalSession, refitAllTerminalSessions } from '$lib/terminalSession'
  import type { ExplorerPaneDropTarget } from '$lib/explorerDropTarget'

  let {
    containerId,
    config = $bindable(),
    openFiles = $bindable(),
    openTerminals = $bindable(),
    fileContents,
    onContentChange,
    onSelectFile,
  }: {
    containerId: string
    config: LayoutConfig
    openFiles: string[]
    openTerminals: string[]
    fileContents: Record<string, string>
    onContentChange: (path: string, content: string) => void
    onSelectFile: (path: string, content: string) => void
  } = $props()

  let activeFile = $state('')
  let emptyPaneFsReady = $state(false)
  let dockContextTarget = $state<ActionTarget>({ kind: 'global' })
  let activePaneTabId = $state<string | null>(null)
  let dockEl = $state<HTMLDivElement | undefined>()

  function trackActivePane(event: FocusEvent | PointerEvent) {
    const target = event.target
    const id = resolveActiveTabIdFromElement(target instanceof Element ? target : null)
    if (id) activePaneTabId = id
  }

  function closeTab(viewId: string) {
    if (isFileViewId(viewId)) handleCloseFile(viewId)
    else if (isTerminalViewId(viewId)) handleCloseTerminal(viewId)
  }

  const derivedTitles = new Map<string, string>()

  function titledView(id: string, derived: string): string {
    derivedTitles.set(id, derived)
    return getTabTitle(id, derived)
  }

  function terminalTitle(sessionId: string) {
    const index = openTerminals.indexOf(sessionId)
    return `Terminal ${index >= 0 ? index + 1 : openTerminals.length + 1}`
  }

  function handleSplit(viewId: string, direction: 'left' | 'right' | 'up' | 'down') {
    if (!tabGroupHasMultipleTabs(config, viewId)) return
    config = splitViewInLayout(config, viewId, direction)
  }

  function handleToggleMaximize(viewId: string) {
    config = toggleMaximizedView(config, viewId)
  }

  function paneLayoutControls(viewId: string) {
    return {
      get canSplit() {
        return tabGroupHasMultipleTabs(config, viewId)
      },
      get maximized() {
        return config.maximizedView === viewId
      },
      onSplit: (direction: 'left' | 'right' | 'up' | 'down') => handleSplit(viewId, direction),
      onToggleMaximize: () => handleToggleMaximize(viewId),
    }
  }

  function handleCloseFile(viewId: string) {
    const path = pathFromFileViewId(viewId)
    if (!path) return
    openFiles = openFiles.filter((filePath) => filePath !== path)
    if (activeFile === path) activeFile = ''
  }

  function handleCloseTerminal(viewId: string) {
    const sessionId = sessionIdFromTerminalViewId(viewId)
    if (!sessionId) return
    disposeTerminalSession(sessionId)
    openTerminals = openTerminals.filter((id) => id !== sessionId)
  }

  function addTerminal() {
    openTerminals = [...openTerminals, createTerminalSessionId()]
  }

  /** Open a file within THIS container (container-scoped open set, shared content store). */
  function selectFileInContainer(path: string, content = '') {
    if (!openFiles.includes(path)) {
      openFiles = [...openFiles, path]
      config = insertFileIntoEmptyPane(config, path)
    }
    if ((fileContents[path] ?? '') !== content) onContentChange(path, content)
    activeFile = path
  }

  async function createFileFromEmptyPane() {
    const fs = sandboxStore.getFs()
    if (!fs) return
    const parent = dirname(activeFile) || '/'
    const created = await createFileInDirectory(fs, parent)
    if (!created) return
    selectFileInContainer(created, '')
  }

  async function handleExplorerFileDrop(path: string, target: ExplorerPaneDropTarget) {
    const fs = sandboxStore.getFs()
    if (!fs) return

    try {
      const stat = await fs.stat(path)
      if (stat.isDirectory) return
    } catch {
      return
    }

    config = openFileAtPaneDrop(config, path, target.anchorViewId, target.side)
    if (!openFiles.includes(path)) openFiles = [...openFiles, path]
    await openFileFromFs(fs, path, (filePath, content) => {
      if ((fileContents[filePath] ?? '') !== content) onContentChange(filePath, content)
      activeFile = filePath
    })
  }

  function renameFileTab(viewId: string) {
    const path = pathFromFileViewId(viewId)
    if (!path) return
    const name = window.prompt('Rename tab', getTabName(viewId) || basename(path))
    if (name === null) return
    setTabName(viewId, name)
  }

  function renameTerminalTab(sessionId: string, viewId: string) {
    const name = window.prompt('Rename tab', getTabName(viewId) || terminalTitle(sessionId))
    if (name === null) return
    setTabName(viewId, name)
  }

  // Dock-scoped actions so container context menus operate on THIS layout.
  $effect(() => {
    actionRunner.registerDock(containerId, {
      getLayout: () => config,
      setLayout: (next) => {
        config = next
      },
      splitView: (viewId, direction) => handleSplit(viewId, direction),
      closeFileTab: (viewId) => handleCloseFile(viewId),
      closeTerminalTab: (viewId) => handleCloseTerminal(viewId),
      addTerminal: () => addTerminal(),
      getOpenFiles: () => openFiles,
      getOpenTerminals: () => openTerminals,
      getActiveFile: () => activeFile,
      selectFile: (path, content) => onSelectFile(path, content),
      closeFile: (path) => {
        openFiles = openFiles.filter((filePath) => filePath !== path)
      },
      renameFile: () => {},
      refreshTree: () => sandboxStore.notifyFilesystemChange(),
      renameFileTab: (viewId) => renameFileTab(viewId),
      renameTerminalTab: (sessionId, viewId) => renameTerminalTab(sessionId, viewId),
      createTabGroup: () => null,
    })
    return () => actionRunner.unregisterDock(containerId)
  })

  $effect(() => {
    const handle = createDockLayoutHandle({
      getConfig: () => config,
      setConfig: (next) => {
        config = next
      },
      getActiveTabId: () => resolveActiveTabInLayout(config, activePaneTabId),
      closeTab,
    })
    setLayoutHandle(containerId, handle)
    return () => setLayoutHandle(containerId, null)
  })

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      emptyPaneFsReady = Boolean(state.fsReady)
    })
    return unsubscribe
  })

  function createFileEditorSnippet(path: string): Snippet {
    const id = fileViewId(path)
    return createRawSnippet(() => ({
      render: () => `<div class="file-editor-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.file-editor-host') ?? element
        const instance = mount(FilePane, {
          target: host,
          props: {
            path,
            get content() {
              return fileContents[path] ?? ''
            },
            get knownPaths() {
              return Object.keys(fileContents)
            },
            ...paneLayoutControls(id),
            onChange: (content: string) => onContentChange(path, content),
            onFocus: () => {
              if (activeFile !== path) activeFile = path
            },
            onNavigateFile: (filePath: string) => {
              const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`
              const existing = fileContents[normalized]
              selectFileInContainer(normalized, existing ?? '')
            },
          },
        })

        return () => unmount(instance)
      },
    }))
  }

  function createTerminalSnippet(sessionId: string): Snippet {
    const id = terminalViewId(sessionId)
    return createRawSnippet(() => ({
      render: () => `<div class="terminal-editor-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.terminal-editor-host') ?? element
        const instance = mount(TerminalPane, {
          target: host,
          props: {
            sessionId,
            title: terminalTitle(sessionId),
            get attachPreviewMessages() {
              return false
            },
            ...paneLayoutControls(id),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  function createEmptyPaneSnippet(): Snippet {
    return createRawSnippet(() => ({
      render: () => `<div class="empty-pane-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.empty-pane-host') ?? element
        const instance = mount(EmptyPane, {
          target: host,
          props: {
            get canCreateFile() {
              return emptyPaneFsReady
            },
            get canCreateFolder() {
              return emptyPaneFsReady
            },
            onCreateFile: () => {
              void createFileFromEmptyPane()
            },
            onCreateFolder: () => {},
            onOpenTerminal: () => addTerminal(),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  function buildViews(files: string[], terminals: string[]): SvelteMap<string, View> {
    const map = new SvelteMap<string, View>()

    for (const path of files) {
      const id = fileViewId(path)
      map.set(id, {
        title: titledView(id, basename(path)),
        snippet: createFileEditorSnippet(path),
        tabControls: [fileTabIcon, fileTabClose],
      })
    }

    for (const sessionId of terminals) {
      const id = terminalViewId(sessionId)
      map.set(id, {
        title: titledView(id, terminalTitle(sessionId)),
        snippet: createTerminalSnippet(sessionId),
        tabControls: [terminalTabIcon, terminalTabClose],
      })
    }

    map.set(EMPTY_PANE_VIEW_ID, {
      title: titledView(EMPTY_PANE_VIEW_ID, 'Blank'),
      snippet: createEmptyPaneSnippet(),
      tabControls: [],
    })

    return map
  }

  let views = $state(buildViews(collectFilePaths(config), openTerminals))

  function syncFileViews(files: string[]) {
    const desiredIds = new Set(files.map(fileViewId))

    for (const id of views.keys()) {
      if (isFileViewId(id) && !desiredIds.has(id)) {
        views.delete(id)
      }
    }

    for (const path of files) {
      const id = fileViewId(path)
      if (!views.has(id)) {
        views.set(id, {
          title: titledView(id, basename(path)),
          snippet: createFileEditorSnippet(path),
          tabControls: [fileTabIcon, fileTabClose],
        })
      }
    }
  }

  function syncTerminalViews(terminals: string[]) {
    const desiredIds = new Set(terminals.map(terminalViewId))

    for (const id of views.keys()) {
      if (isTerminalViewId(id) && !desiredIds.has(id)) {
        views.delete(id)
      }
    }

    for (const sessionId of terminals) {
      const id = terminalViewId(sessionId)
      const existing = views.get(id)
      views.set(id, {
        title: titledView(id, terminalTitle(sessionId)),
        snippet: existing?.snippet ?? createTerminalSnippet(sessionId),
        tabControls: [terminalTabIcon, terminalTabClose],
      })
    }
  }

  function syncLayoutWithFiles(files: string[]): string[] {
    const layoutPaths = collectFilePaths(config)
    const desired = new Set(files)
    const orphans: string[] = []

    let next = config
    for (const path of layoutPaths) {
      if (!desired.has(path)) {
        // Adopt tabs that exist in persisted config but not in the open set,
        // instead of silently dropping them.
        orphans.push(path)
        next = removeFileFromLayout(next, path)
      }
    }
    for (const path of files) {
      if (!layoutPaths.includes(path)) next = addFileToLayout(next, path)
    }
    if (next !== config) config = next
    return orphans
  }

  function syncLayoutWithTerminals(terminals: string[]) {
    const sessionIds = collectTerminalSessionIds(config)
    const desired = new Set(terminals)

    let next = config
    for (const sessionId of sessionIds) {
      if (!desired.has(sessionId)) next = removeTerminalFromLayout(next, sessionId)
    }
    for (const sessionId of terminals) {
      if (!sessionIds.includes(sessionId)) next = addTerminalToLayout(next, sessionId)
    }
    if (next !== config) config = next
  }

  $effect(() => {
    const files = openFiles
    untrack(() => {
      syncFileViews(files)
      const orphans = syncLayoutWithFiles(files)
      if (orphans.length) {
        const adopt = [...new Set([...openFiles, ...orphans])]
        queueMicrotask(() => {
          openFiles = adopt
        })
      }
    })
  })

  $effect(() => {
    const terminals = openTerminals
    untrack(() => {
      syncTerminalViews(terminals)
      syncLayoutWithTerminals(terminals)
    })
  })

  $effect(() => {
    JSON.stringify(config)
    untrack(() => {
      refitAllTerminalSessions()
    })
  })

  $effect(() => {
    const namesChanged = { ...tabNames }
    untrack(() => {
      if (!Object.keys(namesChanged).length) return
      for (const [id, view] of views) {
        const derived = derivedTitles.get(id)
        if (!derived) continue
        const next = getTabTitle(id, derived)
        if (view.title !== next) views.set(id, { ...view, title: next })
      }
    })
  })

  function actionTargetForViewId(viewId: string): ActionTarget | null {
    const path = pathFromFileViewId(viewId)
    if (path) return { kind: 'fileTab', path, viewId }

    const sessionId = sessionIdFromTerminalViewId(viewId)
    if (sessionId) return { kind: 'terminalTab', sessionId, viewId }

    return null
  }

  function handleDockContextMenu(event: MouseEvent) {
    const el = event.target as Element | null
    const tab = el?.closest?.('[role="tab"][data-view-id]') as HTMLElement | null
    const viewId = tab?.getAttribute('data-view-id') ?? null
    dockContextTarget = (viewId && actionTargetForViewId(viewId)) || { kind: 'global' }
  }
</script>

{#snippet fileTabIcon(viewId: string)}
  {@const path = pathFromFileViewId(viewId)}
  {#if path}
    <FileIcon {path} class="size-3.5!" />
  {/if}
{/snippet}

{#snippet terminalTabIcon(_viewId: string)}
  <TerminalSquareIcon class="size-3.5 shrink-0 opacity-80" />
{/snippet}

{#snippet fileTabClose(viewId: string)}
  {@const path = pathFromFileViewId(viewId)}
  {#if path}
    <button
      type="button"
      class="hl-tab-close"
      aria-label="Close {basename(path)}"
      onmousedown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation()
        handleCloseFile(viewId)
      }}
    >
      <XIcon class="size-3" />
    </button>
  {/if}
{/snippet}

{#snippet terminalTabClose(viewId: string)}
  <button
    type="button"
    class="hl-tab-close"
    aria-label="Close {terminalTitle(sessionIdFromTerminalViewId(viewId) ?? '')}"
    onmousedown={(event) => event.stopPropagation()}
    onclick={(event) => {
      event.stopPropagation()
      handleCloseTerminal(viewId)
    }}
  >
    <XIcon class="size-3" />
  </button>
{/snippet}

{#snippet newTerminalControl(viewId: string)}
  {#if isTerminalViewId(viewId)}
    <button type="button" class="hl-new-terminal" aria-label="New terminal" onclick={addTerminal}>
      <PlusIcon class="size-3.5" />
    </button>
  {/if}
{/snippet}

<div
  bind:this={dockEl}
  class="nested-dock h-full min-h-0 overflow-hidden"
  data-dock-id={containerId}
  onpointerdown={(event) => {
    actionRunner.setActiveDock(containerId)
    trackActivePane(event)
  }}
  onfocusin={trackActivePane}
  oncontextmenucapture={handleDockContextMenu}
>
  <ExplorerWorkspaceDrop
    dockEl={dockEl}
    onFileDrop={(path, target) => void handleExplorerFileDrop(path, target)}
  />
  <ContextMenuHost target={dockContextTarget} triggerClass="contents">
    <HorizonLayout bind:config {views} tabgroupControls={[newTerminalControl]} />
  </ContextMenuHost>
</div>

<style>
  :global(.nested-dock .horizon-layout-tabgroup__tab) {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 14rem;
  }

  :global(.nested-dock .horizon-layout-tabgroup__tab-title) {
    order: 5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.nested-dock .horizon-layout-tabgroup__tab-controls) {
    display: contents;
  }

  :global(.nested-dock .horizon-layout-tabgroup__tab-control) {
    order: 0;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  :global(.nested-dock .horizon-layout-tabgroup__tab-control + .horizon-layout-tabgroup__tab-control) {
    order: 20;
  }

  :global(.nested-dock .hl-tab-close),
  :global(.nested-dock .hl-new-terminal) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
    color: inherit;
    opacity: 0.65;
    cursor: pointer;
    padding: 0;
  }

  :global(.nested-dock .hl-new-terminal) {
    width: 1.25rem;
    height: 1.25rem;
  }

  :global(.nested-dock .hl-tab-close:hover),
  :global(.nested-dock .hl-new-terminal:hover) {
    opacity: 1;
    background: color-mix(in oklch, var(--color-foreground) 12%, transparent);
  }
</style>
