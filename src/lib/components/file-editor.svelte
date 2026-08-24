<script lang="ts">
  import CodeEditor from '$lib/components/code-editor.svelte'
  import MarkdownWithFrontmatter from '$lib/components/markdown-with-frontmatter.svelte'
  import type { MarkdownEditorRef } from '$lib/components/markdown-editor.svelte'
  import { isMarkdownPath, type MarkdownEditorMode } from '$lib/fileTypes'

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
    mode?: MarkdownEditorMode
    onChange: (content: string) => void
    onFocus: () => void
    knownPaths?: string[]
    onNavigateFile?: (filePath: string) => void
    onEditorRef?: (ref: MarkdownEditorRef | undefined) => void
  } = $props()

  const markdown = $derived(isMarkdownPath(path))
</script>

{#if markdown}
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
        <CodeEditor {path} {content} {onChange} {onFocus} />
      {/if}
    </div>
  </div>
{:else}
  <CodeEditor {path} {content} {onChange} {onFocus} />
{/if}
