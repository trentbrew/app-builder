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
  import StarterKit from '@tiptap/starter-kit'
  import { Markdown } from '@tiptap/markdown'
  import TaskList from '@tiptap/extension-task-list'
  import TaskItem from '@tiptap/extension-task-item'
  import Placeholder from '@tiptap/extension-placeholder'
  import Image from '@tiptap/extension-image'
  import { Callout } from '$lib/tiptap/callout'
  import { Mermaid } from '$lib/tiptap/mermaid'
  import { ImagePaste } from '$lib/tiptap/image-paste'
  import { MarkdownPaste } from '$lib/tiptap/markdown-paste'
  import { SlashCommand } from '$lib/tiptap/slash-command'
  import { Mention } from '$lib/tiptap/mention'
  import { MentionSuggestion } from '$lib/tiptap/mention-suggestion'
  import type { MentionItem } from '$lib/tiptap/mention-suggestion'
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
    onEditorRef?: (ref: MarkdownEditorRef | undefined) => void
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
        canUndo = instance.can().undo()
        canRedo = instance.can().redo()
      },
      redo: () => {
        instance.chain().focus().redo().run()
        canUndo = instance.can().undo()
        canRedo = instance.can().redo()
      },
      canUndo: () => canUndo,
      canRedo: () => canRedo,
    })
  }

  onMount(() => {
    if (!browser || !root) return

    const instance = new Editor({
      element: root,
      content: untrack(() => value),
      contentType: 'markdown',
      extensions: [
        StarterKit,
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({
          placeholder: 'Type something…',
          emptyEditorClass: 'is-editor-empty',
        }),
        Image.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: { class: 'markdown-image' },
        }),
        Callout,
        Mermaid,
        Mention.configure({
          onNavigate: ({ id }) => onNavigateRef.current?.(id),
        }),
        MentionSuggestion.configure({
          char: '@',
          search: (query) => mentionSearchRef.current(query),
        }),
        SlashCommand,
        ImagePaste,
        MarkdownPaste,
        Markdown,
      ],
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
