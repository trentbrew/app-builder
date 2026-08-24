<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import FileEditor from '$lib/components/file-editor.svelte'
  import type { MarkdownEditorRef } from '$lib/components/markdown-editor.svelte'
  import { countLines, formatBytes } from '$lib/formatBytes'
  import { basename } from '$lib/fileIcons'
  import { isMarkdownPath, isRunnablePath, type MarkdownEditorMode } from '$lib/fileTypes'
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
  const runnable = $derived(isRunnablePath(path))
  const fileName = $derived(basename(path))
  const language = $derived(languageLabelForPath(path))
  const byteSize = $derived(new TextEncoder().encode(content).byteLength)
  const lineCount = $derived(countLines(content))
  const hasFrontmatter = $derived(Boolean(parseFrontmatter(content)))

  let mode = $state<MarkdownEditorMode>('rich')
  let editorRef = $state<MarkdownEditorRef | undefined>()
  let canUndo = $state(false)
  let canRedo = $state(false)

  function loadMode(filePath: string): MarkdownEditorMode {
    if (!browser) return 'rich'
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY)
      if (!raw) return 'rich'
      const map = JSON.parse(raw) as Record<string, MarkdownEditorMode>
      return map[filePath] === 'raw' ? 'raw' : 'rich'
    } catch {
      return 'rich'
    }
  }

  function saveMode(filePath: string, nextMode: MarkdownEditorMode) {
    if (!browser) return
    try {
      const raw = localStorage.getItem(MODE_STORAGE_KEY)
      const map = raw ? (JSON.parse(raw) as Record<string, MarkdownEditorMode>) : {}
      map[filePath] = nextMode
      localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify(map))
    } catch {
      // ignore storage failures
    }
  }

  $effect(() => {
    mode = loadMode(path)
  })

  function setMode(nextMode: MarkdownEditorMode) {
    mode = nextMode
    saveMode(path, nextMode)
  }

  function handleEditorRef(ref: MarkdownEditorRef | undefined) {
    editorRef = ref
    canUndo = ref?.canUndo() ?? false
    canRedo = ref?.canRedo() ?? false
  }

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
    onChange(serializeFrontmatter(createEmptyFrontmatter()) + content)
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  async function syncToSandbox() {
    const normalized = path.startsWith('/') ? path : `/${path}`
    try {
      await sandboxStore.write(normalized, content)
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
        <span class="pane-toolbar__detail">{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
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

        <button
          type="button"
          class="pane-toolbar__btn"
          title="Copy file contents"
          aria-label="Copy to clipboard"
          onclick={copyContent}
        >
          <CopyIcon class="size-3.5" />
        </button>
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
        {/if}
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <FileEditor
      {path}
      {content}
      {mode}
      {knownPaths}
      {onChange}
      {onFocus}
      {onNavigateFile}
      onEditorRef={markdown && mode === 'rich' ? handleEditorRef : undefined}
    />
  {/snippet}
</PaneChrome>
