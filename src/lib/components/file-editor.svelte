<script lang="ts">
  import CodeEditor from '$lib/components/code-editor.svelte'
  import CsvTable from '$lib/components/csv-table.svelte'
  import FontViewer from '$lib/components/font-viewer.svelte'
  import ImageViewer from '$lib/components/image-viewer.svelte'
  import MarkdownWithFrontmatter from '$lib/components/markdown-with-frontmatter.svelte'
  import MermaidViewer from '$lib/components/mermaid-viewer.svelte'
  import Model3dViewer from '$lib/components/model3d-viewer.svelte'
  import MediaViewer from '$lib/components/media-viewer.svelte'
  import PdfViewer from '$lib/components/pdf-viewer.svelte'
  import SvgViewer from '$lib/components/svg-viewer.svelte'
  import TextureViewer from '$lib/components/texture-viewer.svelte'
  import type { EditorRef } from '$lib/actionContext'
  import {
    fileKindForPath,
    isGlbPath,
    isMarkdownPath,
    isMermaidPath,
    isSvgPath,
    type FileViewMode,
  } from '$lib/fileTypes'

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
  const mermaid = $derived(isMermaidPath(path))
  const svg = $derived(isSvgPath(path))
</script>

{#if kind === 'pdf'}
  <PdfViewer {path} />
{:else if kind === 'video' || kind === 'audio'}
  <MediaViewer {path} {kind} />
{:else if kind === 'image'}
  <ImageViewer {path} />
{:else if kind === 'font'}
  <FontViewer {path} />
{:else if kind === 'texture'}
  <TextureViewer {path} />
{:else if kind === 'model3d'}
  {#if isGlbPath(path) || mode === 'rich'}
    <Model3dViewer {path} {content} />
  {:else}
    <CodeEditor {path} {content} {onChange} {onFocus} {onEditorRef} />
  {/if}
{:else if kind === 'csv' && mode === 'table'}
  <CsvTable {path} {content} {onChange} />
{:else if mermaid}
  <div class="file-editor flex h-full min-h-0 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-hidden">
      {#if mode === 'rich'}
        <MermaidViewer source={content} />
      {:else}
        <CodeEditor {path} {content} {onChange} {onFocus} {onEditorRef} />
      {/if}
    </div>
  </div>
{:else if svg}
  <div class="file-editor flex h-full min-h-0 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-hidden">
      {#if mode === 'rich'}
        <SvgViewer source={content} />
      {:else}
        <CodeEditor {path} {content} {onChange} {onFocus} {onEditorRef} />
      {/if}
    </div>
  </div>
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
