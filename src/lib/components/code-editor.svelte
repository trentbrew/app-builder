<script lang="ts">
  import { Compartment, EditorState } from '@codemirror/state'
  import {
    EditorView,
    keymap,
    highlightSpecialChars,
    drawSelection,
    highlightActiveLine,
    dropCursor,
    lineNumbers,
    highlightActiveLineGutter,
    placeholder,
  } from '@codemirror/view'
  import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands'
  import {
    syntaxHighlighting,
    defaultHighlightStyle,
    bracketMatching,
    foldGutter,
    indentOnInput,
  } from '@codemirror/language'
  import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
  import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
  import { showMinimap } from '@replit/codemirror-minimap'
  import { codeMirrorThemeExtension } from '$lib/codemirrorTheme'
  import { THEME_CHANGE_EVENT } from '$lib/theme/apply'
  import { languageExtensionForPath } from '$lib/codemirrorLanguage'
  import { isLargeDoc, isLargeText, isMarkdownPath } from '$lib/fileTypes'
  import { browser } from '$app/environment'
  import { untrack } from 'svelte'
  import type { EditorRef } from '$lib/actionContext'

  let {
    path,
    content = '',
    onChange,
    onFocus,
    onEditorRef,
  }: {
    path: string
    content?: string
    onChange: (content: string) => void
    onFocus: () => void
    onEditorRef?: (ref: EditorRef | undefined) => void
  } = $props()

  let container = $state<HTMLDivElement | undefined>()
  let view = $state<EditorView | undefined>()
  const languageCompartment = new Compartment()
  const extrasCompartment = new Compartment()
  const themeCompartment = new Compartment()
  let lastEmitted = ''
  let changeTimer: ReturnType<typeof setTimeout> | undefined

  const minimapCreate = () => ({
    dom: document.createElement('div'),
  })

  function extrasForSize(large: boolean) {
    if (large) return []
    return [
      autocompletion(),
      foldGutter(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      showMinimap.compute(['doc'], () => ({
        create: minimapCreate,
        displayText: 'blocks',
        showOverlay: 'always',
      })),
    ]
  }

  function emitChange(text: string, large: boolean) {
    lastEmitted = text
    if (changeTimer) clearTimeout(changeTimer)
    if (!large) {
      onChange(text)
      return
    }
    changeTimer = setTimeout(() => onChange(text), 150)
  }

  function buildExtensions(filePath: string, initialDoc: string) {
    const large = isLargeText(initialDoc)
    return [
      themeCompartment.of(codeMirrorThemeExtension()),
      languageCompartment.of(large ? [] : languageExtensionForPath(filePath)),
      extrasCompartment.of(extrasForSize(large)),
      lineNumbers(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      keymap.of([
        ...closeBracketsKeymap,
        ...completionKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      ...(isMarkdownPath(filePath) && !large ? [EditorView.lineWrapping, placeholder('Type something…')] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const { doc } = update.state
          emitChange(doc.toString(), isLargeDoc(doc.length, doc.lines))
        }
      }),
    ]
  }

  $effect(() => {
    if (!browser || !container) return

    const host = container
    const filePath = untrack(() => path)
    const initialDoc = untrack(() => content ?? '')
    lastEmitted = initialDoc

    const state = EditorState.create({
      doc: initialDoc,
      extensions: buildExtensions(filePath, initialDoc),
    })

    const editorView = new EditorView({ state, parent: host })
    view = editorView

    return () => {
      onEditorRef?.(undefined)
      editorView.destroy()
      if (view === editorView) view = undefined
    }
  })

  $effect(() => {
    const editorView = view
    if (!editorView?.dom.isConnected) return

    const syncTheme = () => {
      editorView.dispatch({
        effects: themeCompartment.reconfigure(codeMirrorThemeExtension()),
      })
    }

    document.addEventListener(THEME_CHANGE_EVENT, syncTheme)
    return () => document.removeEventListener(THEME_CHANGE_EVENT, syncTheme)
  })

  $effect(() => {
    const editorView = view
    if (!editorView?.dom.isConnected) return

    const next = content ?? ''
    if (next === lastEmitted) return
    let current = ''
    try {
      current = editorView.state.doc.toString()
    } catch {
      return
    }
    if (next === current) return

    lastEmitted = next
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: next },
    })
  })

  $effect(() => {
    const editorView = view
    if (!editorView?.dom.isConnected) return

    if (isLargeDoc(editorView.state.doc.length, editorView.state.doc.lines)) return
    editorView.dispatch({
      effects: languageCompartment.reconfigure(languageExtensionForPath(path)),
    })
  })

  function handleFocusIn(event: FocusEvent) {
    if (!event.isTrusted) return
    onFocus()
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="code-editor h-full min-h-0 overflow-hidden" bind:this={container} onfocusin={handleFocusIn}></div>

<style>
  .code-editor {
    font-family: var(--font-mono);
  }

  .code-editor :global(.cm-editor) {
    height: 100%;
    background-color: var(--color-background) !important;
  }

  .code-editor :global(.cm-scroller) {
    overflow: auto;
    background-color: var(--color-background) !important;
  }

  .code-editor :global(.cm-content),
  .code-editor :global(.cm-gutters) {
    font-size: var(--editor-font-size);
  }

  .code-editor :global(.cm-gutters) {
    background-color: var(--color-editor-gutter) !important;
    border-right: 1px solid var(--color-border);
    color: var(--color-muted-foreground);
  }

  .code-editor :global(.cm-activeLine),
  .code-editor :global(.cm-activeLineGutter) {
    background-color: var(--color-active-line) !important;
  }

  .code-editor :global(.cm-minimap) {
    border-left: 1px solid var(--color-border);
    background: color-mix(in oklch, var(--color-background) 88%, var(--color-muted));
  }
</style>
