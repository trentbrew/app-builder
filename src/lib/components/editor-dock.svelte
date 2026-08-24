<script lang="ts">
  import { cloneConfig, HorizonLayout, type LayoutConfig, type View } from 'horizon-layout'
  import { SvelteMap } from 'svelte/reactivity'
  import { createRawSnippet, mount, unmount, untrack, type Snippet } from 'svelte'
  import FilePane from '$lib/components/file-pane.svelte'
  import FilesPane from '$lib/components/files-pane.svelte'
  import LogsPane from '$lib/components/logs-pane.svelte'
  import ConsolePane from '$lib/components/console-pane.svelte'
  import PreviewPane from '$lib/components/preview-pane.svelte'
  import SettingsPane from '$lib/components/settings-pane.svelte'
  import TerminalPane from '$lib/components/terminal-pane.svelte'
  import FileIcon from '$lib/components/file-icon.svelte'
  import {
    PANEL_IDS,
    activateFileInLayout,
    addFileToLayout,
    addTerminalToLayout,
    collectFilePaths,
    collectTerminalSessionIds,
    createInitialLayout,
    createTerminalSessionId,
    fileViewId,
    isFileActiveInLayout,
    isFileViewId,
    isTerminalViewId,
    isConsolePanelVisible,
    isSettingsOpen,
    loadSavedLayout,
    openSettingsInLayout,
    closeSettingsInLayout,
    pathFromFileViewId,
    removeFileFromLayout,
    removeTerminalFromLayout,
    saveLayout,
    sessionIdFromTerminalViewId,
    setConsolePanelVisible,
    splitViewInLayout,
    tabGroupHasMultipleTabs,
    terminalViewId,
  } from '$lib/editorLayout'
  import { basename } from '$lib/fileIcons'
  import { refreshPreviewPosition } from '$lib/previewFrame'
  import { editorChrome } from '$lib/editorChrome.svelte'
  import XIcon from '@lucide/svelte/icons/x'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import FolderTreeIcon from '@lucide/svelte/icons/folder-tree'
  import MonitorIcon from '@lucide/svelte/icons/monitor'
  import ScrollTextIcon from '@lucide/svelte/icons/scroll-text'
  import TerminalSquareIcon from '@lucide/svelte/icons/terminal'
  import BugIcon from '@lucide/svelte/icons/bug'
  import SettingsIcon from '@lucide/svelte/icons/settings'

  let {
    openFiles,
    fileContents,
    activeFile = $bindable(),
    onContentChange,
    onCloseFile,
    onSelectFile,
  }: {
    openFiles: string[]
    fileContents: Record<string, string>
    activeFile: string
    onContentChange: (path: string, content: string) => void
    onCloseFile: (path: string) => void
    onSelectFile: (path: string, content: string) => void
  } = $props()

  const initialTerminalId = createTerminalSessionId()
  const startingLayout = cloneConfig(
    loadSavedLayout() ?? createInitialLayout(['/App.svelte'], initialTerminalId),
  )
  editorChrome.setConsoleVisible(isConsolePanelVisible(startingLayout))
  editorChrome.setSettingsOpen(isSettingsOpen(startingLayout))
  let config = $state<LayoutConfig>(startingLayout)
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const restoredTerminals = collectTerminalSessionIds(startingLayout)
  let openTerminals = $state<string[]>(
    restoredTerminals.length ? restoredTerminals : [initialTerminalId],
  )

  function terminalTitle(sessionId: string) {
    const index = openTerminals.indexOf(sessionId)
    return `Terminal ${index >= 0 ? index + 1 : openTerminals.length + 1}`
  }

  function handleSplit(viewId: string, direction: 'left' | 'right' | 'up' | 'down') {
    if (!tabGroupHasMultipleTabs(config, viewId)) return
    config = splitViewInLayout(config, viewId, direction)
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
            get canSplit() {
              return tabGroupHasMultipleTabs(config, id)
            },
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
            onSplit: (direction) => handleSplit(id, direction),
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
            get canSplit() {
              return tabGroupHasMultipleTabs(config, id)
            },
            onSplit: (direction) => handleSplit(id, direction),
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
            get canSplit() {
              return tabGroupHasMultipleTabs(config, viewId)
            },
            onSplit: (direction: 'left' | 'right' | 'up' | 'down') => handleSplit(viewId, direction),
          },
        })
        return () => unmount(instance)
      },
    }))
  }

  function createSettingsSnippet(): Snippet {
    return createRawSnippet(() => ({
      render: () => `<div class="panel-host h-full min-h-0"></div>`,
      setup: (element) => {
        const host = element.querySelector('.panel-host') ?? element
        const instance = mount(SettingsPane, {
          target: host,
          props: {
            get canSplit() {
              return tabGroupHasMultipleTabs(config, PANEL_IDS.settings)
            },
            onSplit: (direction) => handleSplit(PANEL_IDS.settings, direction),
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
            get canSplit() {
              return tabGroupHasMultipleTabs(config, PANEL_IDS.files)
            },
            onSelectFile: (path: string, content: string) => onSelectFile(path, content),
            onSplit: (direction) => handleSplit(PANEL_IDS.files, direction),
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
    settings: createSettingsSnippet(),
  } as const

  function createPanelView(title: string, snippet: Snippet): View {
    return {
      title,
      snippet,
      tabControls: [panelTabIcon],
    }
  }

  function buildInitialViews(files: string[], terminals: string[]): SvelteMap<string, View> {
    const map = new SvelteMap<string, View>()

    for (const path of files) {
      map.set(fileViewId(path), {
        title: basename(path),
        snippet: createFileEditorSnippet(path),
        tabControls: [fileTabIcon, fileTabClose],
      })
    }

    for (const sessionId of terminals) {
      map.set(terminalViewId(sessionId), {
        title: terminalTitle(sessionId),
        snippet: createTerminalSnippet(sessionId),
        tabControls: [terminalTabIcon, terminalTabClose],
      })
    }

    map.set(PANEL_IDS.files, createPanelView('Files', panelSnippets.files))
    map.set(PANEL_IDS.preview, createPanelView('Preview', panelSnippets.preview))
    map.set(PANEL_IDS.logs, createPanelView('Server logs', panelSnippets.logs))
    map.set(PANEL_IDS.console, createPanelView('Console', panelSnippets.console))
    map.set(PANEL_IDS.settings, {
      title: 'Settings',
      snippet: panelSnippets.settings,
      tabControls: [settingsTabIcon, settingsTabClose],
    })

    return map
  }

  let views = $state(buildInitialViews(collectFilePaths(startingLayout), openTerminals))

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
          title: basename(path),
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
        title: terminalTitle(sessionId),
        snippet: existing?.snippet ?? createTerminalSnippet(sessionId),
        tabControls: [terminalTabIcon, terminalTabClose],
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

  function syncOpenTerminalsFromLayout() {
    const ordered = collectTerminalSessionIds(config)
    if (!ordered.length) return

    const sameIds =
      ordered.length === openTerminals.length &&
      ordered.every((sessionId) => openTerminals.includes(sessionId))

    if (sameIds && ordered.join('|') !== openTerminals.join('|')) {
      openTerminals = ordered
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
    JSON.stringify(config)
    untrack(() => {
      syncOpenTerminalsFromLayout()
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

  $effect(() => {
    const open = editorChrome.settingsOpen
    untrack(() => {
      const inLayout = isSettingsOpen(config)
      if (open && !inLayout) {
        config = openSettingsInLayout(config)
      } else if (!open && inLayout) {
        config = closeSettingsInLayout(config)
      } else if (open && inLayout) {
        config = openSettingsInLayout(config)
      }
    })
  })

  $effect(() => {
    JSON.stringify(config)
    untrack(() => {
      const open = isSettingsOpen(config)
      if (open !== editorChrome.settingsOpen) {
        editorChrome.setSettingsOpen(open)
      }
    })
  })

  $effect(() => {
    JSON.stringify(config)
    untrack(() => {
      refreshPreviewPosition()
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
    if (!sessionId || openTerminals.length <= 1) return
    openTerminals = openTerminals.filter((id) => id !== sessionId)
  }

  function handleCloseSettings() {
    editorChrome.closeSettings()
  }

  function addTerminal() {
    openTerminals = [...openTerminals, createTerminalSessionId()]
  }
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

{#snippet settingsTabIcon(_viewId: string)}
  <SettingsIcon class="size-3.5 shrink-0 opacity-80" />
{/snippet}

{#snippet settingsTabClose(viewId: string)}
  {#if viewId === PANEL_IDS.settings}
    <button
      type="button"
      class="hl-tab-close"
      aria-label="Close Settings"
      onmousedown={(event) => event.stopPropagation()}
      onclick={(event) => {
        event.stopPropagation()
        handleCloseSettings()
      }}
    >
      <XIcon class="size-3" />
    </button>
  {/if}
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
  {#if openTerminals.length > 1}
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
  {/if}
{/snippet}

{#snippet newTerminalControl(viewId: string)}
  {#if isTerminalViewId(viewId)}
    <button type="button" class="hl-new-terminal" aria-label="New terminal" onclick={addTerminal}>
      <PlusIcon class="size-3.5" />
    </button>
  {/if}
{/snippet}

<div class="editor-dock h-full min-h-0 overflow-hidden">
  <HorizonLayout bind:config {views} tabgroupControls={[newTerminalControl]} />
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
  :global(.editor-dock .hl-new-terminal) {
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

  :global(.editor-dock .hl-new-terminal) {
    width: 1.25rem;
    height: 1.25rem;
  }

  :global(.editor-dock .hl-tab-close:hover),
  :global(.editor-dock .hl-new-terminal:hover) {
    opacity: 1;
    background: color-mix(in oklch, var(--color-foreground) 12%, transparent);
  }
</style>
