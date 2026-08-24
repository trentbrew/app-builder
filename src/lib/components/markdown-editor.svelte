<script lang="ts" module>
  export interface MarkdownEditorRef {
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
  }
</script>

<script lang="ts">
  import { Editor } from '@tiptap/core'
  import { createMarkdownExtensions } from '$lib/tiptap/markdown-extensions.js'
  import type { EditorRef } from '$lib/actionContext'
  import { browser } from '$app/environment'
  import { onMount, untrack } from 'svelte'

  let {
    value,
    onChange,
    active = true,
    onFocus,
    onEditorRef,
    onNavigateFile,
    mentionSearch = () => [],
  }: {
    value: string
    onChange: (value: string) => void
    active?: boolean
    onFocus?: () => void
    onEditorRef?: (ref: EditorRef | undefined) => void
    onNavigateFile?: (path: string) => void
    mentionSearch?: (query: string) => MentionItem[] | Promise<MentionItem[]>
  } = $props()

  let root = $state<HTMLDivElement | undefined>()
  let editor = $state<Editor | undefined>()
  let canUndo = $state(false)
  let canRedo = $state(false)
  let sent = untrack(() => value)

  const mentionSearchRef = { current: mentionSearch }
  const onNavigateRef = { current: onNavigateFile }

  $effect(() => {
    mentionSearchRef.current = mentionSearch
    onNavigateRef.current = onNavigateFile
  })

  function publishRef(instance: Editor | undefined) {
    if (!instance) {
      onEditorRef?.(undefined)
      return
    }
    onEditorRef?.({
      undo: () => {
        instance.chain().focus().undo().run()
      },
      redo: () => {
        instance.chain().focus().redo().run()
      },
      canUndo: () => instance.can().undo(),
      canRedo: () => instance.can().redo(),
      cut: () => {
        instance.chain().focus().run()
        document.execCommand('cut')
      },
      copy: () => {
        instance.chain().focus().run()
        document.execCommand('copy')
      },
      paste: () => {
        instance.chain().focus().run()
        document.execCommand('paste')
      },
    })
  }

  onMount(() => {
    if (!browser || !root) return

    const instance = new Editor({
      element: root,
      content: untrack(() => value),
      contentType: 'markdown',
      extensions: createMarkdownExtensions({
        mode: 'editor',
        mentionSearch: (query) => mentionSearchRef.current(query),
        onNavigateFile: (path) => onNavigateRef.current?.(path),
      }),
      editorProps: {
        attributes: {
          class: 'markdown-editor-content min-h-full outline-none',
          'data-component': 'markdown',
          spellcheck: 'false',
        },
        handleDOMEvents: {
          focus: () => {
            onFocus?.()
            return false
          },
        },
      },
      onCreate: ({ editor: created }) => {
        canUndo = created.can().undo()
        canRedo = created.can().redo()
        publishRef(created)
      },
      onUpdate: ({ editor: next }) => {
        const md = next.getMarkdown()
        sent = md
        onChange(md)
        canUndo = next.can().undo()
        canRedo = next.can().redo()
        publishRef(next)
      },
    })

    editor = instance

    return () => {
      onEditorRef?.(undefined)
      instance.destroy()
      editor = undefined
    }
  })

  $effect(() => {
    const nextValue = value
    const current = editor
    if (!current) return
    if (nextValue === sent) return
    sent = nextValue
    current.commands.setContent(nextValue, { contentType: 'markdown' })
  })

  $effect(() => {
    if (!active || !editor) return
    queueMicrotask(() => editor?.commands.focus())
  })
</script>

<div data-component="file-markdown" class="markdown-editor h-full min-h-0 overflow-auto">
  <div bind:this={root} data-component="file-markdown-editor" class="min-h-full"></div>
</div>
