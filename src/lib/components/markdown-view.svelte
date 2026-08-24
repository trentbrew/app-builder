<script lang="ts">
  import { Editor } from '@tiptap/core'
  import { browser } from '$app/environment'
  import { createMarkdownExtensions } from '$lib/tiptap/markdown-extensions.js'
  import { cn } from '$lib/utils.js'
  import { onMount, untrack } from 'svelte'

  let {
    markdown = '',
    compact = false,
    variant = 'default',
    class: className,
  }: {
    markdown?: string
    compact?: boolean
    variant?: 'default' | 'user'
    class?: string
  } = $props()

  let root = $state<HTMLDivElement | undefined>()
  let editor = $state<Editor | undefined>()
  let synced = untrack(() => markdown)

  onMount(() => {
    if (!browser || !root) return

    const instance = new Editor({
      element: root,
      content: untrack(() => markdown),
      contentType: 'markdown',
      editable: false,
      extensions: createMarkdownExtensions({ mode: 'view' }),
      editorProps: {
        attributes: {
          class: cn('markdown-view-content outline-none', className),
          'data-component': 'markdown',
          spellcheck: 'false',
          tabindex: '-1',
        },
      },
    })

    editor = instance

    return () => {
      instance.destroy()
      editor = undefined
    }
  })

  $effect(() => {
    const next = markdown
    const current = editor
    if (!current) return
    if (next === synced) return
    synced = next
    current.commands.setContent(next, { contentType: 'markdown', emitUpdate: false })
  })
</script>

<div
  data-component="file-markdown"
  class={cn('markdown-view', compact && 'markdown-view--compact', variant === 'user' && 'markdown-view--user')}
>
  <div bind:this={root} data-component="file-markdown-editor"></div>
</div>

<style>
  :global(.markdown-view) {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  :global(.markdown-view--compact[data-component='file-markdown']) :global([data-component='markdown']) {
    padding: 0;
    max-width: none;
    min-height: 0;
    margin: 0;
    line-height: 1.6;
    font-size: inherit;
  }

  :global(.markdown-view--compact[data-component='file-markdown']) :global([data-component='markdown'] h2) {
    margin-top: 1rem;
  }

  :global(.markdown-view--compact[data-component='file-markdown']) :global([data-component='markdown'] h3) {
    margin-top: 0.75rem;
  }

  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown']),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] p),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] li),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] td),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] th),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] h1),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] h2),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] h3),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] a),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] strong),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] em),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] blockquote),
  :global(.markdown-view--user[data-component='file-markdown']) :global([data-component='markdown'] code) {
    color: inherit;
  }
</style>
