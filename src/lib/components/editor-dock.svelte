<script lang="ts">
  import { cloneConfig, HorizonLayout, type LayoutConfig, type View } from 'horizon-layout'
  import { SvelteMap } from 'svelte/reactivity'
  import { createRawSnippet, mount, unmount, untrack, type Snippet } from 'svelte'
  import FilePane from '$lib/components/file-pane.svelte'
  import FilesPane from '$lib/components/files-pane.svelte'
  import LogsPane from '$lib/components/logs-pane.svelte'
  import ConsolePane from '$lib/components/console-pane.svelte'
  import AgentPane from '$lib/components/agent-pane.svelte'
  import PreviewPane from '$lib/components/preview-pane.svelte'
  import TerminalPane from '$lib/components/terminal-pane.svelte'
  import FileIcon from '$lib/components/file-icon.svelte'
  import {
    PANEL_IDS,
    activateFileInLayout,
    addFileToLayout,
    addTerminalToLayout,
    addAgentToLayout,
    applyLayoutPreset,
    collectFilePaths,
    collectTerminalSessionIds,
    collectAgentSessionIds,
    createInitialLayout,
    createTerminalSessionId,
    createAgentSessionId,
    fileViewId,
    isFileActiveInLayout,
    isFileViewId,
    isTerminalViewId,
    isAgentViewId,
    agentViewId,
    sessionIdFromAgentViewId,
    isConsolePanelVisible,
    isAgentPanelVisible,
    loadSavedLayout,
    pathFromFileViewId,
    removeFileFromLayout,
    removeTerminalFromLayout,
    removeAgentFromLayout,
    EMPTY_PANE_VIEW_ID,
    insertFileIntoEmptyPane,
    addViewToPreferredGroup,
    collectGroupViewIds,
    removeViewFromLayout,
    resolveActiveTabInLayout,
    saveLayout,
    sessionIdFromTerminalViewId,
    setConsolePanelVisible,
    setAgentPanelVisible,
    splitViewInLayout,
    tabGroupHasMultipleTabs,
    terminalViewId,
    toggleMaximizedView,
  } from '$lib/editorLayout'
  import { actionRunner } from '$lib/actionRunner.svelte'
  import type { EditorLayoutPresetId } from '$lib/editorLayoutPresets'
  import NestedDock from '$lib/components/nested-dock.svelte'
  import {
    containers,
    createContainer,
    destroyContainer,
    ensureContainer,
    getContainer,
    groupViewId,
    groupIdFromViewId,
    isGroupViewId,
    renameContainer,
    setContainerFiles,
    setContainerTerminals,
  } from '$lib/containerTabs.svelte'
  import EmptyPane from '$lib/components/empty-pane.svelte'
  import { createFileInDirectory, createFolderInDirectory } from '$lib/fileOps'
  import { dirname } from '$lib/fileTreeOps'
  import { sandboxStore } from '$lib/sandboxStore'
  import { getTabTitle, getTabName, setTabName, tabNames } from '$lib/tabNames.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import type { ActionTarget, PaneKind } from '$lib/actionContext'
  import { basename } from '$lib/fileIcons'
  import { refreshPreviewPosition } from '$lib/previewFrame'
  import { disposeTerminalSession, refitAllTerminalSessions } from '$lib/terminalSession'
  import { disposeAgentChatSession, registerPrimaryAgentSession } from '$lib/agentChatSessions'
  import { closeAgentPanel, isAgentPanelOpen, openAgentPanel } from '$lib/agentHarness/harnessStore.svelte'
  import { editorChrome } from '$lib/editorChrome.svelte'
  import { createDockLayoutHandle, resolveActiveTabIdFromElement } from '$lib/layoutKeyboard'
  import { setLayoutHandle } from '$lib/layoutHandle'
  import XIcon from '@lucide/svelte/icons/x'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import FolderTreeIcon from '@lucide/svelte/icons/folder-tree'
  import MonitorIcon from '@lucide/svelte/icons/monitor'
  import ScrollTextIcon from '@lucide/svelte/icons/scroll-text'
  import TerminalSquareIcon from '@lucide/svelte/icons/terminal'
  import BugIcon from '@lucide/svelte/icons/bug'
  import MessageCircleIcon from '@lucide/svelte/icons/message-circle'

  let {
    entryPath = '/App.svelte',
    openFiles,
    fileContents,
    activeFile = $bindable(),
    onContentChange,
    onCloseFile,
    onSelectFile,
    onRenameFile,
  }: {
    entryPath?: string
    openFiles: string[]
    fileContents: Record<string, string>
    activeFile: string
    onContentChange: (path: string, content: string) => void
    onCloseFile: (path: string) => void
    onSelectFile: (path: string, content: string) => void
    onRenameFile: (oldPath: string, newPath: string) => void
  } = $props()

  const normalizedEntryPath = entryPath.startsWith('/') ? entryPath : `/${entryPath}`
  const initialTerminalId = createTerminalSessionId()
  const baseLayout = loadSavedLayout() ?? createInitialLayout([normalizedEntryPath], initialTerminalId)
  const restoredAgentsFromSave = collectAgentSessionIds(baseLayout)
  const initialLayout =
    !isAgentPanelOpen() && isAgentPanelVisible(baseLayout) ? setAgentPanelVisible(baseLayout, false) : baseLayout
  editorChrome.setConsoleVisible(isConsolePanelVisible(initialLayout))
  let config = $state<LayoutConfig>(cloneConfig(initialLayout))
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let emptyPaneFsReady = $state(false)

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      emptyPaneFsReady = Boolean(state.fsReady)
    })
    return unsubscribe
  })

  const restoredTerminals = collectTerminalSessionIds(initialLayout)
  let openTerminals = $state<string[]>(restoredTerminals.length ? restoredTerminals : [initialTerminalId])

  const restoredAgents = restoredAgentsFromSave.length ? restoredAgentsFromSave : collectAgentSessionIds(initialLayout)
  if (restoredAgents[0]) registerPrimaryAgentSession(restoredAgents[0])
  let openAgentSessions = $state<string[]>(restoredAgents)

  function terminalTitle(sessionId: string) {
    const index = openTerminals.indexOf(sessionId)
    return `Terminal ${index >= 0 ? index + 1 : openTerminals.length + 1}`
  }

  function agentTitle(sessionId: string) {
    const index = openAgentSessions.indexOf(sessionId)
    return `Agent ${index >= 0 ? index + 1 : openAgentSessions.length + 1}`
  }

  function agentWorkspaceContext() {
    const serialized = JSON.stringify(config)
    return {
      openFiles,
      activeFile,
      openTerminals: openTerminals.length,
      panes: {
        preview: serialized.includes(PANEL_IDS.preview),
        logs: serialized.includes(PANEL_IDS.logs),
        console: isConsolePanelVisible(config),
      },
    }
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
              if (activeFile !== normalized) activeFile = normalized
              const existing = fileContents[normalized]
              if (existing !== undefined) {
                onSelectFile(normalized, existing)
                return
              }
              onSelectFile(normalized, '')
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
              return openTerminals[0] === sessionId
            },
            ...paneLayoutControls(id),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  function createAgentSnippet(sessionId: string): Snippet {
    const id = agentViewId(sessionId)
    return createRawSnippet(() => ({
      render: () => `<div class="agent-editor-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.agent-editor-host') ?? element
        const instance = mount(AgentPane, {
          target: host,
          props: {
            sessionId,
            get knownPaths() {
              return Object.keys(fileContents)
            },
            get workspaceContext() {
              return agentWorkspaceContext()
            },
            ...paneLayoutControls(id),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  function createPersistentPanelSnippet(
    component: typeof PreviewPane | typeof LogsPane | typeof ConsolePane,
    viewId: string,
  ): Snippet {
    return createRawSnippet(() => ({
      render: () => `<div class="panel-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.panel-host') ?? element
        const instance = mount(component, {
          target: host,
          props: {
            ...paneLayoutControls(viewId),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  function createFileExplorerSnippet(): Snippet {
    return createRawSnippet(() => ({
      render: () => `<div class="panel-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.panel-host') ?? element
        const instance = mount(FilesPane, {
          target: host,
          props: {
            get activeFile() {
              return activeFile
            },
            ...paneLayoutControls(PANEL_IDS.files),
            onSelectFile: (path: string, content: string) => onSelectFile(path, content),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  const panelSnippets = {
    files: createFileExplorerSnippet(),
    preview: createPersistentPanelSnippet(PreviewPane, PANEL_IDS.preview),
    logs: createPersistentPanelSnippet(LogsPane, PANEL_IDS.logs),
    console: createPersistentPanelSnippet(ConsolePane, PANEL_IDS.console),
  } as const

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
            onCreateFolder: () => {
              void createFolderFromEmptyPane()
            },
            onOpenTerminal: () => addTerminal(),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  /** Derived (fallback) title per view id, so renames can be applied and reverted. */
  const derivedTitles = new Map<string, string>()

  function titledView(id: string, derived: string): string {
    derivedTitles.set(id, derived)
    return getTabTitle(id, derived)
  }

  function createPanelView(title: string, snippet: Snippet): View {
    return {
      title,
      snippet,
      tabControls: [panelTabIcon],
    }
  }

  function buildInitialViews(files: string[], terminals: string[], agents: string[]): SvelteMap<string, View> {
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

    for (const sessionId of agents) {
      const id = agentViewId(sessionId)
      map.set(id, {
        title: titledView(id, agentTitle(sessionId)),
        snippet: createAgentSnippet(sessionId),
        tabControls: [agentTabIcon, agentTabClose],
      })
    }

    map.set(PANEL_IDS.files, createPanelView(titledView(PANEL_IDS.files, 'Files'), panelSnippets.files))
    map.set(PANEL_IDS.preview, createPanelView(titledView(PANEL_IDS.preview, 'Preview'), panelSnippets.preview))
    map.set(PANEL_IDS.logs, createPanelView(titledView(PANEL_IDS.logs, 'Server logs'), panelSnippets.logs))
    map.set(PANEL_IDS.console, createPanelView(titledView(PANEL_IDS.console, 'Console'), panelSnippets.console))
    map.set(EMPTY_PANE_VIEW_ID, {
      title: titledView(EMPTY_PANE_VIEW_ID, 'Blank'),
      snippet: createEmptyPaneSnippet(),
      tabControls: [],
    })
    for (const groupView of collectGroupViewIds(initialLayout)) {
      const id = groupIdFromViewId(groupView)
      if (!id) continue
      ensureContainer(id)
      map.set(groupView, {
        title: titledView(groupView, getContainer(id)?.label ?? 'Group'),
        snippet: createContainerSnippet(id),
        tabControls: [groupTabClose],
      })
    }

    return map
  }

  let views = $state(buildInitialViews(collectFilePaths(initialLayout), openTerminals, openAgentSessions))

  $effect(() => {
    JSON.stringify(config)
    untrack(() => {
      for (const viewId of collectGroupViewIds(config)) {
        const groupId = groupIdFromViewId(viewId)
        if (!groupId) continue

        const container = ensureContainer(groupId)
        const label = container.label
        derivedTitles.set(viewId, label)

        if (!views.has(viewId)) {
          views.set(viewId, {
            title: getTabTitle(viewId, label),
            snippet: createContainerSnippet(groupId),
            tabControls: [groupTabClose],
          })
        } else {
          const view = views.get(viewId)!
          const next = getTabTitle(viewId, label)
          if (view.title !== next) views.set(viewId, { ...view, title: next })
        }
      }

      // Drop views for groups no longer present in the layout.
      const live = new Set(collectGroupViewIds(config))
      for (const id of views.keys()) {
        if (isGroupViewId(id) && !live.has(id)) views.delete(id)
      }
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

  function syncAgentViews(agents: string[]) {
    const desiredIds = new Set(agents.map(agentViewId))

    for (const id of views.keys()) {
      if (isAgentViewId(id) && !desiredIds.has(id)) {
        views.delete(id)
      }
    }

    for (const sessionId of agents) {
      const id = agentViewId(sessionId)
      const existing = views.get(id)
      views.set(id, {
        title: titledView(id, agentTitle(sessionId)),
        snippet: existing?.snippet ?? createAgentSnippet(sessionId),
        tabControls: [agentTabIcon, agentTabClose],
      })
    }
  }

  function syncLayoutWithOpenFiles(files: string[]) {
    const layoutPaths = collectFilePaths(config)
    const desired = new Set(files)

    let next = config
    for (const path of layoutPaths) {
      if (!desired.has(path)) {
        next = removeFileFromLayout(next, path)
      }
    }
    for (const path of files) {
      if (!layoutPaths.includes(path)) {
        next = addFileToLayout(next, path)
      }
    }

    if (JSON.stringify(next) !== JSON.stringify(config)) {
      config = next
    }
  }

  function syncLayoutWithOpenTerminals(terminals: string[]) {
    const layoutTerminals = collectTerminalSessionIds(config)
    const desired = new Set(terminals)

    let next = config
    for (const sessionId of layoutTerminals) {
      if (!desired.has(sessionId)) {
        next = removeTerminalFromLayout(next, sessionId)
      }
    }
    for (const sessionId of terminals) {
      if (!layoutTerminals.includes(sessionId)) {
        next = addTerminalToLayout(next, sessionId)
      }
    }

    if (JSON.stringify(next) !== JSON.stringify(config)) {
      config = next
    }
  }

  function syncLayoutWithOpenAgents(agents: string[]) {
    if (!isAgentPanelOpen()) return

    if (!agents.length && isAgentPanelVisible(config)) {
      syncOpenAgentsFromLayout()
      return
    }

    const layoutAgents = collectAgentSessionIds(config)
    const desired = new Set(agents)

    let next = config
    for (const sessionId of layoutAgents) {
      if (!desired.has(sessionId)) {
        next = removeAgentFromLayout(next, sessionId)
      }
    }
    for (const sessionId of agents) {
      if (!layoutAgents.includes(sessionId)) {
        next = addAgentToLayout(next, sessionId)
      }
    }

    if (JSON.stringify(next) !== JSON.stringify(config)) {
      config = next
    }
  }

  function syncOpenTerminalsFromLayout() {
    const ordered = collectTerminalSessionIds(config)
    if (!ordered.length) return

    const sameIds =
      ordered.length === openTerminals.length && ordered.every((sessionId) => openTerminals.includes(sessionId))

    if (sameIds && ordered.join('|') !== openTerminals.join('|')) {
      openTerminals = ordered
    }
  }

  function syncOpenAgentsFromLayout() {
    const ordered = collectAgentSessionIds(config)
    if (!ordered.length) return

    const sameIds =
      ordered.length === openAgentSessions.length && ordered.every((sessionId) => openAgentSessions.includes(sessionId))

    if (!sameIds) {
      if (!openAgentSessions.length && ordered[0]) registerPrimaryAgentSession(ordered[0])
      openAgentSessions = ordered
      return
    }

    if (ordered.join('|') !== openAgentSessions.join('|')) {
      openAgentSessions = ordered
    }
  }

  $effect(() => {
    const files = openFiles
    untrack(() => {
      syncFileViews(files)
      syncLayoutWithOpenFiles(files)
    })
  })

  $effect(() => {
    const terminals = openTerminals
    untrack(() => {
      syncTerminalViews(terminals)
      syncLayoutWithOpenTerminals(terminals)
    })
  })

  $effect(() => {
    const agents = openAgentSessions
    untrack(() => {
      syncAgentViews(agents)
      syncLayoutWithOpenAgents(agents)
    })
  })

  $effect(() => {
    JSON.stringify(config)
    untrack(() => {
      syncOpenTerminalsFromLayout()
      syncOpenAgentsFromLayout()
    })
  })

  $effect(() => {
    const path = activeFile
    untrack(() => {
      if (!isFileActiveInLayout(config, path)) {
        config = activateFileInLayout(config, path)
      }
    })
  })

  $effect(() => {
    const visible = editorChrome.consoleVisible
    untrack(() => {
      if (isConsolePanelVisible(config) === visible) return
      config = setConsolePanelVisible(config, visible)
    })
  })

  function ensureAgentSessionId() {
    if (openAgentSessions.length) return openAgentSessions[0]
    const sessionId = createAgentSessionId()
    registerPrimaryAgentSession(sessionId)
    openAgentSessions = [sessionId]
    return sessionId
  }

  function showAgentPanelInLayout() {
    if (isAgentPanelVisible(config)) return

    let next = config
    const sessions = openAgentSessions.length ? openAgentSessions : [ensureAgentSessionId()]
    for (const sessionId of sessions) {
      next = addAgentToLayout(next, sessionId)
    }
    config = next
  }

  function hideAgentPanelInLayout() {
    if (!isAgentPanelVisible(config)) return
    config = setAgentPanelVisible(config, false)
  }

  $effect(() => {
    const open = isAgentPanelOpen()
    untrack(() => {
      if (open) showAgentPanelInLayout()
      else hideAgentPanelInLayout()
    })
  })

  $effect(() => {
    JSON.stringify(config)
    untrack(() => {
      refreshPreviewPosition()
      refitAllTerminalSessions()
    })
  })

  $effect(() => {
    JSON.stringify(config)
    untrack(() => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => saveLayout(config), 120)
    })

    return () => clearTimeout(saveTimer)
  })

  function handleCloseFile(viewId: string) {
    const path = pathFromFileViewId(viewId)
    if (!path) return
    onCloseFile(path)
  }

  function handleCloseTerminal(viewId: string) {
    const sessionId = sessionIdFromTerminalViewId(viewId)
    if (!sessionId) return
    disposeTerminalSession(sessionId)
    openTerminals = openTerminals.filter((id) => id !== sessionId)
  }

  function handleCloseAgent(viewId: string) {
    const sessionId = sessionIdFromAgentViewId(viewId)
    if (!sessionId) return
    disposeAgentChatSession(sessionId)
    openAgentSessions = openAgentSessions.filter((id) => id !== sessionId)
    if (!openAgentSessions.length) closeAgentPanel()
  }

  function addTerminal() {
    openTerminals = [...openTerminals, createTerminalSessionId()]
  }

  function addAgent() {
    const sessionId = createAgentSessionId()
    if (!openAgentSessions.length) registerPrimaryAgentSession(sessionId)
    if (!isAgentPanelVisible(config)) openAgentPanel()
    openAgentSessions = [...openAgentSessions, sessionId]
  }

  async function createFileFromEmptyPane() {
    const fs = sandboxStore.getFs()
    if (!fs) return
    const parent = dirname(activeFile) || '/'
    const created = await createFileInDirectory(fs, parent)
    if (!created) return
    config = insertFileIntoEmptyPane(config, created)
    onSelectFile(created, '')
  }

  async function createFolderFromEmptyPane() {
    const fs = sandboxStore.getFs()
    if (!fs) return
    const parent = dirname(activeFile) || '/'
    await createFolderInDirectory(fs, parent)
  }

  function createContainerSnippet(groupId: string): Snippet {
    return createRawSnippet(() => ({
      render: () => `<div class="container-dock-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.container-dock-host') ?? element
        const instance = mount(NestedDock, {
          target: host,
          props: {
            containerId: groupId,
            get config() {
              return containers[groupId]?.config ?? { root: { tabs: [EMPTY_PANE_VIEW_ID], activeTabIndex: 0 } }
            },
            set config(next) {
              renameContainer(groupId, next)
            },
            get openFiles() {
              return containers[groupId]?.openFiles ?? []
            },
            set openFiles(next) {
              setContainerFiles(groupId, next)
            },
            get openTerminals() {
              return containers[groupId]?.openTerminals ?? []
            },
            set openTerminals(next) {
              setContainerTerminals(groupId, next)
            },
            fileContents,
            onContentChange,
            onSelectFile,
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  function handleCloseGroup(viewId: string) {
    const groupId = groupIdFromViewId(viewId)
    if (!groupId) return

    // Salvage terminal sessions so closing a group never orphans a live shell.
    const container = getContainer(groupId)
    if (container) {
      for (const sessionId of collectTerminalSessionIds(container.config)) {
        if (!openTerminals.includes(sessionId)) {
          openTerminals = [...openTerminals, sessionId]
        }
      }
    }

    // Remove from layout BEFORE destroying state: the config setter writes
    // through to the container store, which must still exist.
    config = removeViewFromLayout(config, viewId)
    destroyContainer(groupId)
  }

  function handleCreateTabGroup(): string | null {
    const container = createContainer()
    config = addViewToPreferredGroup(config, groupViewId(container.id))
    return groupViewId(container.id)
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

  function renameAgentTab(sessionId: string, viewId: string) {
    const name = window.prompt('Rename tab', getTabName(viewId) || agentTitle(sessionId))
    if (name === null) return
    setTabName(viewId, name)
  }

  const PANEL_PANE_KINDS: Record<string, PaneKind> = {
    [PANEL_IDS.files]: 'files',
    [PANEL_IDS.preview]: 'preview',
    [PANEL_IDS.logs]: 'logs',
    [PANEL_IDS.console]: 'console',
    [PANEL_IDS.agent]: 'chat',
  }

  let dockContextTarget = $state<ActionTarget>({ kind: 'global' })
  let activePaneTabId = $state<string | null>(null)

  function trackActivePane(event: FocusEvent | PointerEvent) {
    const target = event.target
    const id = resolveActiveTabIdFromElement(target instanceof Element ? target : null)
    if (id) activePaneTabId = id
  }

  function closeTab(viewId: string) {
    if (isFileViewId(viewId)) handleCloseFile(viewId)
    else if (isTerminalViewId(viewId)) handleCloseTerminal(viewId)
    else if (isAgentViewId(viewId)) handleCloseAgent(viewId)
    else if (isGroupViewId(viewId)) handleCloseGroup(viewId)
    else config = removeViewFromLayout(config, viewId)
  }

  function actionTargetForViewId(viewId: string): ActionTarget | null {
    const path = pathFromFileViewId(viewId)
    if (path) return { kind: 'fileTab', path, viewId }

    const sessionId = sessionIdFromTerminalViewId(viewId)
    if (sessionId) return { kind: 'terminalTab', sessionId, viewId }

    const agentSessionId = sessionIdFromAgentViewId(viewId)
    if (agentSessionId) return { kind: 'agentTab', sessionId: agentSessionId, viewId }

    const paneKind = PANEL_PANE_KINDS[viewId]
    if (paneKind) return { kind: 'pane', paneId: viewId, paneKind }

    const groupId = groupIdFromViewId(viewId)
    if (groupId && getContainer(groupId)) return { kind: 'groupTab', groupId, viewId }

    return null
  }

  function handleDockPointerDown(event: PointerEvent) {
    const path = event.composedPath() as Element[]
    const dockEl = path.find((el) => el instanceof HTMLElement && el.dataset.dockId) as HTMLElement | undefined
    actionRunner.setActiveDock(dockEl?.dataset.dockId ?? null)
  }

  function handleDockContextMenu(event: MouseEvent) {
    const el = event.target as Element | null
    const tab = el?.closest?.('[role="tab"][data-view-id]') as HTMLElement | null
    const viewId = tab?.getAttribute('data-view-id') ?? null
    dockContextTarget = (viewId && actionTargetForViewId(viewId)) || { kind: 'global' }
  }

  function handleApplyLayoutPreset(presetId: EditorLayoutPresetId) {
    let agentSessionIds = openAgentSessions
    if (presetId === 'agent-focus' && !agentSessionIds.length) {
      agentSessionIds = [ensureAgentSessionId()]
    }

    const includeAgent =
      presetId === 'agent-focus' ? true : isAgentPanelVisible(config)

    config = applyLayoutPreset(config, presetId, {
      filePaths: openFiles,
      terminalSessionIds: openTerminals,
      agentSessionIds,
      includeAgent,
      includeConsole: isConsolePanelVisible(config),
    })

    if (presetId === 'agent-focus') openAgentPanel()

    return true
  }

  $effect(() => {
    const path = activeFile
    untrack(() => {
      if (!path || !isFileActiveInLayout(config, path)) return
      activePaneTabId = fileViewId(path)
    })
  })

  $effect(() => {
    actionRunner.register({
      getLayout: () => config,
      setLayout: (next) => {
        config = next
      },
      splitView: (viewId, direction) => handleSplit(viewId, direction),
      closeFileTab: (viewId) => handleCloseFile(viewId),
      closeTerminalTab: (viewId) => handleCloseTerminal(viewId),
      closeAgentTab: (viewId) => handleCloseAgent(viewId),
      addTerminal: () => addTerminal(),
      getOpenFiles: () => openFiles,
      getOpenTerminals: () => openTerminals,
      getActiveFile: () => activeFile,
      selectFile: (path, content) => onSelectFile(path, content),
      closeFile: (path) => onCloseFile(path),
      renameFile: (oldPath, newPath) => onRenameFile(oldPath, newPath),
      refreshTree: () => sandboxStore.notifyFilesystemChange(),
      renameFileTab: (viewId) => renameFileTab(viewId),
      renameTerminalTab: (sessionId, viewId) => renameTerminalTab(sessionId, viewId),
      renameAgentTab: (sessionId, viewId) => renameAgentTab(sessionId, viewId),
      createTabGroup: () => handleCreateTabGroup(),
      applyLayoutPreset: (presetId) => handleApplyLayoutPreset(presetId),
    })
    return () => actionRunner.reset()
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
    setLayoutHandle('root', handle)
    return () => setLayoutHandle('root', null)
  })
</script>

{#snippet panelTabIcon(viewId: string)}
  {#if viewId === PANEL_IDS.files}
    <FolderTreeIcon class="size-3.5 shrink-0 opacity-80" />
  {:else if viewId === PANEL_IDS.preview}
    <MonitorIcon class="size-3.5 shrink-0 opacity-80" />
  {:else if viewId === PANEL_IDS.logs}
    <ScrollTextIcon class="size-3.5 shrink-0 opacity-80" />
  {:else if viewId === PANEL_IDS.console}
    <BugIcon class="size-3.5 shrink-0 opacity-80" />
  {/if}
{/snippet}

{#snippet agentTabIcon(_viewId: string)}
  <MessageCircleIcon class="size-3.5 shrink-0 opacity-80" />
{/snippet}

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

{#snippet agentTabClose(viewId: string)}
  <button
    type="button"
    class="hl-tab-close"
    aria-label="Close {agentTitle(sessionIdFromAgentViewId(viewId) ?? '')}"
    onmousedown={(event) => event.stopPropagation()}
    onclick={(event) => {
      event.stopPropagation()
      handleCloseAgent(viewId)
    }}
  >
    <XIcon class="size-3" />
  </button>
{/snippet}

{#snippet groupTabClose(viewId: string)}
  {#if isGroupViewId(viewId)}
    <button
      type="button"
      class="hl-tab-close"
      aria-label="Close {views.get(viewId)?.title ?? 'group'}"
      onmousedown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation()
        handleCloseGroup(viewId)
      }}
    >
      <XIcon class="size-3" />
    </button>
  {/if}
{/snippet}

{#snippet newTerminalControl(viewId: string)}
  {#if isTerminalViewId(viewId)}
    <button type="button" class="hl-new-terminal" aria-label="New terminal" onclick={addTerminal}>
      <PlusIcon class="size-3.5" />
    </button>
  {/if}
{/snippet}

{#snippet newAgentControl(viewId: string)}
  {#if isAgentViewId(viewId)}
    <button type="button" class="hl-new-agent" aria-label="New agent session" onclick={addAgent}>
      <PlusIcon class="size-3.5" />
    </button>
  {/if}
{/snippet}

<div
  class="editor-dock h-full min-h-0 overflow-hidden"
  data-dock-id="root"
  onpointerdowncapture={handleDockPointerDown}
  onfocusin={trackActivePane}
  onpointerdown={trackActivePane}
  oncontextmenucapture={handleDockContextMenu}
>
  <ContextMenuHost target={dockContextTarget} triggerClass="contents">
    <HorizonLayout bind:config {views} tabgroupControls={[newTerminalControl, newAgentControl]} />
  </ContextMenuHost>
</div>

<style>
  :global(.editor-dock .horizon-layout-tabgroup__tab) {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 14rem;
  }

  :global(.editor-dock .horizon-layout-tabgroup__tab-title) {
    order: 5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.editor-dock .horizon-layout-tabgroup__tab-controls) {
    display: contents;
  }

  :global(.editor-dock .horizon-layout-tabgroup__tab-control) {
    order: 0;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  :global(.editor-dock .horizon-layout-tabgroup__tab-control + .horizon-layout-tabgroup__tab-control) {
    order: 20;
  }

  :global(.editor-dock .hl-tab-close),
  :global(.editor-dock .hl-new-terminal),
  :global(.editor-dock .hl-new-agent) {
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

  :global(.editor-dock .hl-new-terminal),
  :global(.editor-dock .hl-new-agent) {
    width: 1.25rem;
    height: 1.25rem;
  }

  :global(.editor-dock .hl-tab-close:hover),
  :global(.editor-dock .hl-new-terminal:hover),
  :global(.editor-dock .hl-new-agent:hover) {
    opacity: 1;
    background: color-mix(in oklch, var(--color-foreground) 12%, transparent);
  }
</style>
