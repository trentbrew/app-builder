<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import FileEditor from '$lib/components/file-editor.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import type { EditorRef } from '$lib/actionContext'
  import { actionRunner } from '$lib/actionRunner.svelte'
  import { countLines, formatBytes } from '$lib/formatBytes'
  import { basename } from '$lib/fileIcons'
  import {
    isBinaryPreviewPath,
    isCsvPath,
    isLargeText,
    isMarkdownPath,
    isRunnablePath,
    type FileViewMode,
  } from '$lib/fileTypes'
  import { languageLabelForPath } from '$lib/languageLabel'
  import { sandboxStore } from '$lib/sandboxStore'
  import { browser } from '$app/environment'
  import { toast } from 'svelte-sonner'
  import BracesIcon from '@lucide/svelte/icons/braces'
  import CodeIcon from '@lucide/svelte/icons/code'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import LetterTextIcon from '@lucide/svelte/icons/letter-text'
  import PlayIcon from '@lucide/svelte/icons/play'
  import RedoIcon from '@lucide/svelte/icons/redo-2'
  import TableIcon from '@lucide/svelte/icons/table'
  import UndoIcon from '@lucide/svelte/icons/undo-2'
  import { parseFrontmatter } from '$lib/frontmatter'
  import { createEmptyFrontmatter, serializeFrontmatter } from '$lib/frontmatterEditor'

  const MODE_STORAGE_KEY = 'app-builder:markdown-mode:v1'

  let {
    path,
    content,
    knownPaths = [],
    canSplit = false,
    onChange,
    onFocus,
    onNavigateFile,
    onSplit,
  }: {
    path: string
    content: string
    knownPaths?: string[]
    canSplit?: boolean
    onChange: (content: string) => void
    onFocus: () => void
    onNavigateFile?: (filePath: string) => void
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
  } = $props()

  const markdown = $derived(isMarkdownPath(path))
  const csv = $derived(isCsvPath(path))
  const binary = $derived(isBinaryPreviewPath(path))
  const runnable = $derived(isRunnablePath(path))
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

  function defaultMode(filePath: string): FileViewMode {
    if (isCsvPath(filePath)) return 'table'
    if (isMarkdownPath(filePath)) return 'rich'
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
      if (isMarkdownPath(filePath)) return stored === 'raw' ? 'raw' : 'rich'
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
  }

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
        else if (markdown) setMode(mode === 'rich' ? 'raw' : 'rich')
      },
      syncToSandbox,
      copyContent,
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
      toast.success(`Synced ${fileName}`)
    } catch {
      toast.error(`Could not sync ${fileName}`)
    }
  }
</script>

<PaneChrome>
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <span class="pane-toolbar__detail">{language}</span>
        <span class="pane-toolbar__detail">{formatBytes(byteSize)}</span>
        {#if !binary}
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
        {#if runnable}
          <button
            type="button"
            class="pane-toolbar__btn"
            title="Sync file to sandbox"
            aria-label="Sync to sandbox"
            onclick={syncToSandbox}
          >
            <PlayIcon class="size-3.5" />
          </button>
        {/if}
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
        {/if}
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
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
