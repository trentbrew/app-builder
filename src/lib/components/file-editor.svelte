<script lang="ts">
  import CodeEditor from '$lib/components/code-editor.svelte'
  import CsvTable from '$lib/components/csv-table.svelte'
  import ImageViewer from '$lib/components/image-viewer.svelte'
  import MarkdownWithFrontmatter from '$lib/components/markdown-with-frontmatter.svelte'
  import MediaViewer from '$lib/components/media-viewer.svelte'
  import PdfViewer from '$lib/components/pdf-viewer.svelte'
  import type { EditorRef } from '$lib/actionContext'
  import { fileKindForPath, isMarkdownPath, type FileViewMode } from '$lib/fileTypes'

  let {
    path,
    content,
    mode = 'rich',
    onChange,
    onFocus,
    knownPaths = [],
    onNavigateFile,
    onEditorRef,
  }: {
    path: string
    content: string
    mode?: FileViewMode
    onChange: (content: string) => void
    onFocus: () => void
    knownPaths?: string[]
    onNavigateFile?: (filePath: string) => void
    onEditorRef?: (ref: EditorRef | undefined) => void
  } = $props()

  const kind = $derived(fileKindForPath(path))
  const markdown = $derived(isMarkdownPath(path))
</script>

{#if kind === 'pdf'}
  <PdfViewer {path} />
{:else if kind === 'video' || kind === 'audio'}
  <MediaViewer {path} {kind} />
{:else if kind === 'image'}
  <ImageViewer {path} />
{:else if kind === 'csv' && mode === 'table'}
  <CsvTable {path} {content} {onChange} />
{:else if markdown}
  <div class="file-editor flex h-full min-h-0 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-hidden">
      {#if mode === 'rich'}
        <MarkdownWithFrontmatter
          {path}
          value={content}
          {onChange}
          {onFocus}
          {knownPaths}
          {onNavigateFile}
          {onEditorRef}
        />
      {:else}
        <CodeEditor {path} {content} {onChange} {onFocus} {onEditorRef} />
      {/if}
    </div>
  </div>
{:else}
  <CodeEditor {path} {content} {onChange} {onFocus} {onEditorRef} />
{/if}
