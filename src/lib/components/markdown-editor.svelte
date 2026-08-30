<script lang="ts" module>
  export type FindAndReplaceState = {
    searchTerm: string
    replaceTerm: string
    caseSensitive: boolean
    useRegex: boolean
    wholeWord: boolean
    results: Array<{ from: number; to: number }>
    currentIndex: number | null
  }

  export interface MarkdownEditorRef {
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
    getCharacterCount: () => number
    getWordCount: () => number
    getFindAndReplaceState: () => FindAndReplaceState
    setSearchTerm: (term: string) => void
    setReplaceTerm: (term: string) => void
    setCaseSensitive: (value: boolean) => void
    setUseRegex: (value: boolean) => void
    setWholeWord: (value: boolean) => void
    goToNextResult: () => void
    goToPreviousResult: () => void
    replace: () => void
    replaceAll: () => void
    clearSearch: () => void
    subscribe: (callback: () => void) => () => void
  }
</script>

<script lang="ts">
  import { Editor } from '@tiptap/core'
  import { createMarkdownExtensions } from '$lib/tiptap/markdown-extensions.js'
  import type { EditorRef } from '$lib/actionContext'
  import { setPreviewUrl } from '$lib/previewFrame.js'
  import { browser } from '$app/environment'
  import { onMount, untrack } from 'svelte'

  let {
    value,
    onChange,
    active = true,
    onFocus,
    onEditorRef,
    onNavigateFile,
    currentFilePath,
    mentionSearch = () => [],
  }: {
    value: string
    onChange: (value: string) => void
    active?: boolean
    onFocus?: () => void
    onEditorRef?: (ref: EditorRef | undefined) => void
    onNavigateFile?: (path: string) => void
    currentFilePath?: string
    mentionSearch?: (query: string) => MentionItem[] | Promise<MentionItem[]>
  } = $props()

  let root = $state<HTMLDivElement | undefined>()
  let editor = $state<Editor | undefined>()
  let canUndo = $state(false)
  let canRedo = $state(false)
  let sent = untrack(() => value)

  const mentionSearchRef = { current: mentionSearch }
  const onNavigateRef = { current: onNavigateFile }
  const currentFilePathRef = { current: currentFilePath }
  const updateListeners = new Set<() => void>()

  $effect(() => {
    mentionSearchRef.current = mentionSearch
    onNavigateRef.current = onNavigateFile
    currentFilePathRef.current = currentFilePath
  })

  function notifyUpdate() {
    for (const listener of updateListeners) listener()
  }

  function createEditorRef(instance: Editor): MarkdownEditorRef {
    return {
      undo: () => {
        instance.chain().focus().undo().run()
      },
      redo: () => {
        instance.chain().focus().redo().run()
      },
      canUndo: () => instance.can().undo(),
      canRedo: () => instance.can().redo(),
      getCharacterCount: () => instance.storage.characterCount?.characters?.() ?? 0,
      getWordCount: () => instance.storage.characterCount?.words?.() ?? 0,
      getFindAndReplaceState: () => {
        const state = instance.storage.findAndReplace
        return {
          searchTerm: state.searchTerm,
          replaceTerm: state.replaceTerm,
          caseSensitive: state.caseSensitive,
          useRegex: state.useRegex,
          wholeWord: state.wholeWord,
          results: state.results,
          currentIndex: state.currentIndex,
        }
      },
      setSearchTerm: (term) => {
        instance.commands.setSearchTerm(term)
      },
      setReplaceTerm: (term) => {
        instance.commands.setReplaceTerm(term)
      },
      setCaseSensitive: (value) => {
        instance.commands.setCaseSensitive(value)
      },
      setUseRegex: (value) => {
        instance.commands.setUseRegex(value)
      },
      setWholeWord: (value) => {
        instance.commands.setWholeWord(value)
      },
      goToNextResult: () => {
        instance.commands.goToNextResult()
      },
      goToPreviousResult: () => {
        instance.commands.goToPreviousResult()
      },
      replace: () => {
        instance.commands.replace()
      },
      replaceAll: () => {
        instance.commands.replaceAll()
      },
      clearSearch: () => {
        instance.commands.clearSearch()
      },
      subscribe: (callback) => {
        updateListeners.add(callback)
        return () => updateListeners.delete(callback)
      },
    }
  }

  function publishRef(instance: Editor | undefined) {
    if (!instance) {
      onEditorRef?.(undefined)
      return
    }
    const ref = createEditorRef(instance)
    onEditorRef?.({
      ...ref,
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
        onOpenUrl: (url) => setPreviewUrl(url),
        getCurrentFilePath: () => currentFilePathRef.current,
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
        queueMicrotask(notifyUpdate)
      },
      onTransaction: () => {
        queueMicrotask(notifyUpdate)
      },
    })

    editor = instance

    return () => {
      updateListeners.clear()
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
