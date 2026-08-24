<script lang="ts">
  import MarkdownEditor, { type MarkdownEditorRef } from '$lib/components/markdown-editor.svelte'
  import FrontmatterPanel from '$lib/components/frontmatter-panel.svelte'
  import { splitFrontmatter } from '$lib/frontmatter'
  import { serializeFrontmatter } from '$lib/frontmatterEditor'
  import { basename } from '$lib/fileIcons'

  let {
    path,
    value,
    onChange,
    onFocus,
    onNavigateFile,
    knownPaths = [],
    onEditorRef,
  }: {
    path: string
    value: string
    onChange: (value: string) => void
    onFocus?: () => void
    onNavigateFile?: (filePath: string) => void
    knownPaths?: string[]
    onEditorRef?: (ref: MarkdownEditorRef | undefined) => void
  } = $props()

  const split = $derived(splitFrontmatter(value))

  function compose(meta: Record<string, unknown> | undefined, body: string) {
    if (!meta) return body
    return serializeFrontmatter(meta) + body
  }

  function onBodyChange(body: string) {
    onChange(compose(split.meta, body))
  }

  function onMetaChange(meta: Record<string, unknown>) {
    onChange(compose(meta, split.body))
  }

  function searchMentions(query: string) {
    const q = query.trim().toLowerCase()
    return knownPaths
      .filter((filePath) => filePath !== path)
      .map((filePath) => ({
        type: 'file' as const,
        id: filePath.replace(/^\//, ''),
        label: basename(filePath),
        detail: filePath,
      }))
      .filter((item) => {
        if (!q) return true
        return (
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.detail ?? '').toLowerCase().includes(q)
        )
      })
  }
</script>

<div class="markdown-with-frontmatter flex h-full min-h-0">
  <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
    <MarkdownEditor
      value={split.body}
      active={true}
      onChange={onBodyChange}
      {onFocus}
      {onEditorRef}
      onNavigateFile={(filePath) => onNavigateFile?.(`/${filePath.replace(/^\//, '')}`)}
      mentionSearch={searchMentions}
    />
  </div>

  {#if split.meta}
    <FrontmatterPanel meta={split.meta} onChange={onMetaChange} defaultOpen={Object.keys(split.meta).length > 1} />
  {/if}
</div>
