<script lang="ts">
  import { Editor } from '@tiptap/core'
  import { browser } from '$app/environment'
  import { createAgentComposerExtensions } from '$lib/tiptap/agent-composer-extensions.js'
  import type { MentionItem } from '$lib/tiptap/mention-suggestion'
  import { onMount } from 'svelte'

  let {
    value = $bindable(''),
    placeholder = 'Message agent…',
    disabled = false,
    mentionSearch = () => [],
    onSubmit,
    onPasteFiles,
  }: {
    value?: string
    placeholder?: string
    disabled?: boolean
    mentionSearch?: (query: string) => MentionItem[] | Promise<MentionItem[]>
    onSubmit?: () => void
    onPasteFiles?: (files: File[]) => void
  } = $props()

  let root = $state<HTMLDivElement | undefined>()
  let editor = $state<Editor | undefined>()

  const mentionSearchRef = { current: mentionSearch }

  $effect(() => {
    mentionSearchRef.current = mentionSearch
  })

  $effect(() => {
    editor?.setEditable(!disabled)
  })

  onMount(() => {
    if (!browser || !root) return

    const instance = new Editor({
      element: root,
      content: value,
      contentType: 'markdown',
      extensions: createAgentComposerExtensions({
        placeholder,
        mentionSearch: (query) => mentionSearchRef.current(query),
      }),
      editorProps: {
        attributes: {
          class: 'agent-composer-editor min-h-10 py-3 text-sm leading-relaxed text-foreground outline-none',
          'data-component': 'agent-composer',
          spellcheck: 'false',
        },
        handleKeyDown: (_view, event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit?.()
            return true
          }
          return false
        },
        handlePaste: (_view, event) => {
          const items = event.clipboardData?.items
          if (!items || !onPasteFiles) return false

          const imageFiles: File[] = []
          for (const item of items) {
            if (item.kind !== 'file') continue
            const file = item.getAsFile()
            if (file?.type.startsWith('image/')) imageFiles.push(file)
          }

          if (imageFiles.length === 0) return false
          event.preventDefault()
          onPasteFiles(imageFiles)
          return true
        },
      },
      onUpdate: ({ editor: next }) => {
        value = next.getMarkdown()
      },
    })

    editor = instance

    return () => {
      instance.destroy()
      editor = undefined
    }
  })

  export function clear() {
    editor?.commands.clearContent()
    value = ''
  }

  export function focus() {
    editor?.commands.focus()
  }

  export function getPlainText() {
    return editor?.getText({ blockSeparator: '\n' }).trim() ?? ''
  }
</script>

<div class="agent-composer-editor-host w-full text-left" class:opacity-60={disabled}>
  <div class="w-full text-left" bind:this={root}></div>
</div>

<style>
  .agent-composer-editor-host {
    padding: 0 0.75rem;
    max-height: min(40vh, 12rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  :global(.agent-composer-editor),
  :global(.agent-composer-editor .ProseMirror) {
    width: 100%;
    text-align: left;
  }

  :global(.agent-composer-editor p) {
    margin: 0;
    text-align: left;
  }

  :global(.agent-composer-editor p.is-editor-empty:first-child::before) {
    color: var(--color-muted-foreground);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  :global(.agent-composer-editor .mention-node) {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    border-radius: 0.25rem;
    background: color-mix(in oklch, var(--color-primary) 12%, var(--color-muted));
    padding: 0 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-foreground);
  }
</style>
