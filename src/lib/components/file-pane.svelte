<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneMaximizeButton from '$lib/components/pane-maximize-button.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import FileEditor from '$lib/components/file-editor.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import type { EditorRef } from '$lib/actionContext'
  import { actionRunner } from '$lib/actionRunner.svelte'
  import { countLines, formatBytes } from '$lib/formatBytes'
  import { basename } from '$lib/fileIcons'
  import {
    hasPreviewToggle,
    isBinaryPreviewPath,
    isCsvPath,
    isLargeText,
    isMarkdownPath,
    isMermaidPath,
    isGlbPath,
    isSvgPath,
    type FileViewMode,
  } from '$lib/fileTypes'
  import { languageLabelForPath } from '$lib/languageLabel'
  import { sandboxStore } from '$lib/sandboxStore'
  import { browser } from '$app/environment'
  import { toast } from '$lib/notify'
  import NodeLoadingOverlay from '$lib/components/node-loading-overlay.svelte'
  import EditorSaveIndicator from '$lib/components/editor-save-indicator.svelte'
  import MarkdownFindReplacePopover from '$lib/components/markdown-find-replace-popover.svelte'
  import BracesIcon from '@lucide/svelte/icons/braces'
  import CodeIcon from '@lucide/svelte/icons/code'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import LetterTextIcon from '@lucide/svelte/icons/letter-text'
  import RedoIcon from '@lucide/svelte/icons/redo-2'
  import TableIcon from '@lucide/svelte/icons/table'
  import UndoIcon from '@lucide/svelte/icons/undo-2'
  import WorkflowIcon from '@lucide/svelte/icons/workflow'
  import ImageIcon from '@lucide/svelte/icons/image'
  import { parseFrontmatter } from '$lib/frontmatter'
  import { createEmptyFrontmatter, serializeFrontmatter } from '$lib/frontmatterEditor'

  const MODE_STORAGE_KEY = 'app-builder:markdown-mode:v1'

  let {
    path,
    content,
    knownPaths = [],
    canSplit = false,
    maximized = false,
    onChange,
    onFocus,
    onNavigateFile,
    onSplit,
    onToggleMaximize,
  }: {
    path: string
    content: string
    knownPaths?: string[]
    canSplit?: boolean
    maximized?: boolean
    onChange: (content: string) => void
    onFocus: () => void
    onNavigateFile?: (filePath: string) => void
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
    onToggleMaximize?: () => void
  } = $props()

  const markdown = $derived(isMarkdownPath(path))
  const mermaid = $derived(isMermaidPath(path))
  const svg = $derived(isSvgPath(path))
  const previewToggle = $derived(hasPreviewToggle(path))
  const csv = $derived(isCsvPath(path))
  const binary = $derived(isBinaryPreviewPath(path))
  const fileName = $derived(basename(path))
  const language = $derived(languageLabelForPath(path))
  const safeContent = $derived(content ?? '')
  const largeText = $derived(!binary && isLargeText(safeContent))
  const byteSize = $derived(new TextEncoder().encode(safeContent).byteLength)
  const lineCount = $derived(binary ? 0 : countLines(safeContent))
  const hasFrontmatter = $derived(Boolean(parseFrontmatter(safeContent)))

  let mode = $state<FileViewMode>('rich')
  let editorRef = $state<EditorRef | undefined>()
  let canUndo = $state(false)
  let canRedo = $state(false)
  let markdownCharCount = $state(0)
  let markdownWordCount = $state(0)
  let sandboxBooting = $state(false)
  let sandboxLoading = $state(false)
  let sandboxFsReady = $state(false)
  let sandboxPhase = $state('')

  $effect(() => {
    const unsubscribe = sandboxStore.subscribe((state) => {
      sandboxBooting = state.booting
      sandboxLoading = state.loading
      sandboxFsReady = state.fsReady
      sandboxPhase = state.phase
    })
    return unsubscribe
  })

  const showSandboxOverlay = $derived(!binary && !sandboxFsReady && (sandboxBooting || sandboxLoading))

  function defaultMode(filePath: string): FileViewMode {
    if (isCsvPath(filePath)) return 'table'
    if (hasPreviewToggle(filePath) || isGlbPath(filePath)) return 'rich'
    return 'raw'
  }

  function loadMode(filePath: string): FileViewMode {
    const fallback = defaultMode(filePath)
    if (!browser) return fallback
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY)
      if (!raw) return fallback
      const map = JSON.parse(raw) as Record<string, FileViewMode>
      const stored = map[filePath]
      if (isCsvPath(filePath)) return stored === 'raw' ? 'raw' : 'table'
      if (hasPreviewToggle(filePath) || isGlbPath(filePath)) return stored === 'raw' ? 'raw' : 'rich'
      return fallback
    } catch {
      return fallback
    }
  }

  function saveMode(filePath: string, nextMode: FileViewMode) {
    if (!browser) return
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY)
      const map = raw ? (JSON.parse(raw) as Record<string, FileViewMode>) : {}
      map[filePath] = nextMode
      localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify(map))
    } catch {
      // ignore storage failures
    }
  }

  $effect(() => {
    mode = loadMode(path)
  })

  function setMode(nextMode: FileViewMode) {
    mode = nextMode
    saveMode(path, nextMode)
  }

  function handleEditorRef(ref: EditorRef | undefined) {
    editorRef = ref
    canUndo = ref?.canUndo() ?? false
    canRedo = ref?.canRedo() ?? false
    syncMarkdownStats()
  }

  function syncMarkdownStats() {
    queueMicrotask(() => {
      markdownCharCount = editorRef?.getCharacterCount?.() ?? 0
      markdownWordCount = editorRef?.getWordCount?.() ?? 0
    })
  }

  $effect(() => {
    const ref = editorRef
    if (!markdown || mode !== 'rich' || !ref?.subscribe) {
      markdownCharCount = 0
      markdownWordCount = 0
      return
    }

    syncMarkdownStats()
    return ref.subscribe(() => {
      syncMarkdownStats()
    })
  })

  const editorTarget = $derived({
    kind: 'fileEditor' as const,
    path,
    editorRef,
    canSplit,
  })

  $effect(() => {
    actionRunner.registerFilePane(path, {
      getEditorRef: () => editorRef,
      toggleMarkdownMode: () => {
        if (csv) setMode(mode === 'table' ? 'raw' : 'table')
        else if (previewToggle) setMode(mode === 'rich' ? 'raw' : 'rich')
      },
      copyContent,
      syncToSandbox,
    })

    return () => actionRunner.unregisterFilePane(path)
  })

  function syncHistoryState() {
    canUndo = editorRef?.canUndo() ?? false
    canRedo = editorRef?.canRedo() ?? false
  }

  function undo() {
    editorRef?.undo()
    syncHistoryState()
  }

  function redo() {
    editorRef?.redo()
    syncHistoryState()
  }

  function addFrontmatter() {
    if (hasFrontmatter) return
    onChange(serializeFrontmatter(createEmptyFrontmatter()) + safeContent)
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(safeContent)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  async function syncToSandbox() {
    const normalized = path.startsWith('/') ? path : `/${path}`
    try {
      await sandboxStore.write(normalized, safeContent)
      toast.success(`Saved ${fileName}`)
    } catch {
      toast.error(`Could not save ${fileName}`)
    }
  }
</script>

<PaneChrome>
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">{language}</span>
        {#if markdown && mode === 'rich'}
          <span class="pane-toolbar__detail">{markdownCharCount} chars</span>
          <span class="pane-toolbar__detail">{markdownWordCount} words</span>
        {/if}
        {#if !binary}
          <span class="pane-toolbar__detail">{formatBytes(byteSize)}</span>
          <span class="pane-toolbar__detail">{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
        {/if}
        {#if largeText}
          <span class="pane-toolbar__detail">Performance mode</span>
        {/if}
      {/snippet}

      {#snippet actions()}
        {#if markdown && mode === 'rich'}
          <button
            type="button"
            class="pane-toolbar__btn"
            title="Undo (Cmd+Z)"
            aria-label="Undo"
            disabled={!canUndo}
            onclick={undo}
          >
            <UndoIcon class="size-3.5" />
          </button>
          <button
            type="button"
            class="pane-toolbar__btn"
            title="Redo (Cmd+Shift+Z)"
            aria-label="Redo"
            disabled={!canRedo}
            onclick={redo}
          >
            <RedoIcon class="size-3.5" />
          </button>
          <MarkdownFindReplacePopover {editorRef} />
          {#if !hasFrontmatter}
            <button
              type="button"
              class="pane-toolbar__btn"
              title="Add YAML frontmatter"
              aria-label="Add properties"
              onclick={addFrontmatter}
            >
              <BracesIcon class="size-3.5" />
            </button>
          {/if}
        {/if}

        {#if !binary}
          <button
            type="button"
            class="pane-toolbar__btn"
            title="Copy file contents"
            aria-label="Copy to clipboard"
            onclick={copyContent}
          >
            <CopyIcon class="size-3.5" />
          </button>
        {/if}
        {#if !binary}
          <EditorSaveIndicator />
        {/if}
        <PaneMaximizeButton {maximized} onToggle={onToggleMaximize} />
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}

      {#snippet viewToggle()}
        {#if markdown}
          <div class="pane-toolbar__group" role="group" aria-label="Markdown editor mode">
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'rich'}
              title="Rich editor"
              aria-pressed={mode === 'rich'}
              onclick={() => setMode('rich')}
            >
              <LetterTextIcon class="size-3.5" />
            </button>
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'raw'}
              title="Markdown source"
              aria-pressed={mode === 'raw'}
              onclick={() => setMode('raw')}
            >
              <CodeIcon class="size-3.5" />
            </button>
          </div>
        {:else if csv}
          <div class="pane-toolbar__group" role="group" aria-label="CSV view mode">
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'table'}
              title="Spreadsheet view"
              aria-pressed={mode === 'table'}
              onclick={() => setMode('table')}
            >
              <TableIcon class="size-3.5" />
            </button>
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'raw'}
              title="CSV source"
              aria-pressed={mode === 'raw'}
              onclick={() => setMode('raw')}
            >
              <CodeIcon class="size-3.5" />
            </button>
          </div>
        {:else if mermaid}
          <div class="pane-toolbar__group" role="group" aria-label="Mermaid view mode">
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'rich'}
              title="Diagram preview"
              aria-label="Diagram preview"
              aria-pressed={mode === 'rich'}
              onclick={() => setMode('rich')}
            >
              <WorkflowIcon class="size-3.5" />
            </button>
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'raw'}
              title="Mermaid source"
              aria-label="Mermaid source"
              aria-pressed={mode === 'raw'}
              onclick={() => setMode('raw')}
            >
              <CodeIcon class="size-3.5" />
            </button>
          </div>
        {:else if svg}
          <div class="pane-toolbar__group" role="group" aria-label="SVG view mode">
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'rich'}
              title="SVG preview"
              aria-pressed={mode === 'rich'}
              onclick={() => setMode('rich')}
            >
              <ImageIcon class="size-3.5" />
            </button>
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'raw'}
              title="SVG source"
              aria-pressed={mode === 'raw'}
              onclick={() => setMode('raw')}
            >
              <CodeIcon class="size-3.5" />
            </button>
          </div>
        {:else if previewToggle}
          <div class="pane-toolbar__group" role="group" aria-label="Preview mode">
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'rich'}
              title="Preview"
              aria-pressed={mode === 'rich'}
              onclick={() => setMode('rich')}
            >
              <ImageIcon class="size-3.5" />
            </button>
            <button
              type="button"
              class="pane-toolbar__btn"
              class:pane-toolbar__btn--active={mode === 'raw'}
              title="Source"
              aria-pressed={mode === 'raw'}
              onclick={() => setMode('raw')}
            >
              <CodeIcon class="size-3.5" />
            </button>
          </div>
        {/if}
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <div class="file-pane-editor relative h-full min-h-0">
      <ContextMenuHost target={editorTarget} triggerClass="file-editor-context-trigger h-full min-h-0">
        <FileEditor
          {path}
          content={safeContent}
          {mode}
          {knownPaths}
          {onChange}
          {onFocus}
          {onNavigateFile}
          onEditorRef={handleEditorRef}
        />
      </ContextMenuHost>
      {#if showSandboxOverlay}
        <NodeLoadingOverlay title="Loading sandbox" message={sandboxPhase || 'Starting sandbox…'} />
      {/if}
    </div>
  {/snippet}
</PaneChrome>

<style>
  :global(.file-editor-context-trigger) {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
  }

  :global(.file-editor-context-trigger > *) {
    flex: 1 1 0;
    min-width: 0;
    width: 100%;
  }
</style>
