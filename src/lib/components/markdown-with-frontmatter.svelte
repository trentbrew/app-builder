<script lang="ts">
  import MarkdownEditor, { type MarkdownEditorRef } from '$lib/components/markdown-editor.svelte'
  import FrontmatterPanel from '$lib/components/frontmatter-panel.svelte'
  import { splitFrontmatter } from '$lib/frontmatter'
  import { serializeFrontmatter } from '$lib/frontmatterEditor'
  import { basename } from '$lib/fileIcons'
  import { settings } from '$lib/settings/store.svelte'
  import { onMount } from 'svelte'

  /** Editor min width + open properties rail (w-72) + flex slack */
  const PROPERTIES_COLLAPSE_BELOW = 720

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
  const propertiesLayout = $derived(settings.editor.markdownPropertiesLayout)
  const inlineProperties = $derived(propertiesLayout === 'inline')

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

  let root = $state<HTMLDivElement | undefined>()
  let containerWidth = $state(0)
  const narrowProperties = $derived(
    !inlineProperties && containerWidth > 0 && containerWidth < PROPERTIES_COLLAPSE_BELOW,
  )

  onMount(() => {
    const element = root
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      containerWidth = entry.contentRect.width
    })
    observer.observe(element)
    containerWidth = element.getBoundingClientRect().width

    return () => observer.disconnect()
  })
</script>

<div
  bind:this={root}
  class="markdown-with-frontmatter flex h-full min-h-0"
  class:flex-col={inlineProperties}
>
  {#if split.meta && inlineProperties}
    <FrontmatterPanel
      meta={split.meta}
      onChange={onMetaChange}
      defaultOpen={Object.keys(split.meta).length > 1}
      layout="inline"
    />
  {/if}

  <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
    <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
      <MarkdownEditor
        value={split.body}
        active={true}
        onChange={onBodyChange}
        {onFocus}
        {onEditorRef}
        currentFilePath={path}
        onNavigateFile={(filePath) => onNavigateFile?.(`/${filePath.replace(/^\//, '')}`)}
        mentionSearch={searchMentions}
      />
    </div>

    {#if split.meta && !inlineProperties}
      <FrontmatterPanel
        meta={split.meta}
        onChange={onMetaChange}
        defaultOpen={Object.keys(split.meta).length > 1}
        narrow={narrowProperties}
        layout="sidebar"
      />
    {/if}
  </div>
</div>
