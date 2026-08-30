<script lang="ts">
  import type { MarkdownEditorRef } from '$lib/components/markdown-editor.svelte'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import { Input } from '$lib/components/ui/input'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import SearchIcon from '@lucide/svelte/icons/search'
  import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import ReplaceIcon from '@lucide/svelte/icons/replace'
  import ReplaceAllIcon from '@lucide/svelte/icons/replace-all'
  import XIcon from '@lucide/svelte/icons/x'

  let {
    editorRef,
    disabled = false,
  }: {
    editorRef?: MarkdownEditorRef
    disabled?: boolean
  } = $props()

  let open = $state(false)
  let searchInput = $state<HTMLInputElement | null>(null)
  let searchTerm = $state('')
  let replaceTerm = $state('')
  let caseSensitive = $state(false)
  let useRegex = $state(false)
  let wholeWord = $state(false)
  let resultCount = $state(0)
  let currentIndex = $state<number | null>(null)

  function syncFromEditor() {
    const state = editorRef?.getFindAndReplaceState?.()
    if (!state) {
      resultCount = 0
      currentIndex = null
      return
    }
    searchTerm = state.searchTerm
    replaceTerm = state.replaceTerm
    caseSensitive = state.caseSensitive
    useRegex = state.useRegex
    wholeWord = state.wholeWord
    resultCount = state.results.length
    currentIndex = state.currentIndex
  }

  function refreshCounts() {
    const state = editorRef?.getFindAndReplaceState?.()
    resultCount = state?.results.length ?? 0
    currentIndex = state?.currentIndex ?? null
  }

  $effect(() => {
    const ref = editorRef
    if (!ref?.subscribe) return
    const unsubscribe = ref.subscribe(() => {
      if (!open) return
      refreshCounts()
    })
    return unsubscribe
  })

  $effect(() => {
    if (!open) {
      editorRef?.clearSearch?.()
      searchTerm = ''
      replaceTerm = ''
      caseSensitive = false
      useRegex = false
      wholeWord = false
      resultCount = 0
      currentIndex = null
      return
    }

    syncFromEditor()
    queueMicrotask(() => {
      searchInput?.focus()
      searchInput?.select()
    })
  })

  const resultLabel = $derived.by(() => {
    if (!searchTerm.trim()) return 'No search'
    if (resultCount === 0) return 'No results'
    if (currentIndex === null) return `${resultCount} results`
    return `${currentIndex + 1} of ${resultCount}`
  })

  function applySearchTerm(term: string) {
    searchTerm = term
    editorRef?.setSearchTerm(term)
    refreshCounts()
  }

  function applyReplaceTerm(term: string) {
    replaceTerm = term
    editorRef?.setReplaceTerm(term)
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) editorRef?.goToPreviousResult?.()
      else editorRef?.goToNextResult?.()
      refreshCounts()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      open = false
    }
  }
</script>

<Popover bind:open>
  <PopoverTrigger
    class="pane-toolbar__btn"
    title="Find and replace"
    aria-label="Find and replace"
    disabled={disabled || !editorRef}
  >
    <SearchIcon class="size-3.5" />
  </PopoverTrigger>
  <PopoverContent align="end" class="w-80 gap-3 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-medium">Find and replace</p>
      <button
        type="button"
        class="pane-toolbar__btn"
        title="Close"
        aria-label="Close find and replace"
        onclick={() => (open = false)}
      >
        <XIcon class="size-3.5" />
      </button>
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <Input
          bind:ref={searchInput}
          class="h-7 text-xs"
          placeholder="Find"
          value={searchTerm}
          oninput={(event) => applySearchTerm(event.currentTarget.value)}
          onkeydown={onSearchKeydown}
        />
        <span class="text-muted-foreground w-16 shrink-0 text-right text-[0.625rem] tabular-nums">
          {resultLabel}
        </span>
      </div>

      <Input
        class="h-7 text-xs"
        placeholder="Replace"
        value={replaceTerm}
        oninput={(event) => applyReplaceTerm(event.currentTarget.value)}
        onkeydown={onSearchKeydown}
      />
    </div>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <label class="flex items-center gap-1.5 text-[0.6875rem]">
        <Checkbox
          checked={caseSensitive}
          onCheckedChange={(checked) => {
            caseSensitive = checked === true
            editorRef?.setCaseSensitive(caseSensitive)
            refreshCounts()
          }}
        />
        Match case
      </label>
      <label class="flex items-center gap-1.5 text-[0.6875rem]">
        <Checkbox
          checked={wholeWord}
          disabled={useRegex}
          onCheckedChange={(checked) => {
            wholeWord = checked === true
            editorRef?.setWholeWord(wholeWord)
            refreshCounts()
          }}
        />
        Whole word
      </label>
      <label class="flex items-center gap-1.5 text-[0.6875rem]">
        <Checkbox
          checked={useRegex}
          onCheckedChange={(checked) => {
            useRegex = checked === true
            editorRef?.setUseRegex(useRegex)
            refreshCounts()
          }}
        />
        Regex
      </label>
    </div>

    <div class="flex items-center justify-end gap-1">
      <button
        type="button"
        class="pane-toolbar__btn"
        title="Previous match"
        aria-label="Previous match"
        disabled={resultCount === 0}
        onclick={() => {
          editorRef?.goToPreviousResult?.()
          refreshCounts()
        }}
      >
        <ChevronUpIcon class="size-3.5" />
      </button>
      <button
        type="button"
        class="pane-toolbar__btn"
        title="Next match"
        aria-label="Next match"
        disabled={resultCount === 0}
        onclick={() => {
          editorRef?.goToNextResult?.()
          refreshCounts()
        }}
      >
        <ChevronDownIcon class="size-3.5" />
      </button>
      <span class="pane-toolbar__sep pane-toolbar__sep--actions" aria-hidden="true"></span>
      <button
        type="button"
        class="pane-toolbar__btn"
        title="Replace"
        aria-label="Replace"
        disabled={resultCount === 0}
        onclick={() => {
          editorRef?.replace?.()
          refreshCounts()
        }}
      >
        <ReplaceIcon class="size-3.5" />
      </button>
      <button
        type="button"
        class="pane-toolbar__btn"
        title="Replace all"
        aria-label="Replace all"
        disabled={resultCount === 0}
        onclick={() => {
          editorRef?.replaceAll?.()
          refreshCounts()
        }}
      >
        <ReplaceAllIcon class="size-3.5" />
      </button>
    </div>
  </PopoverContent>
</Popover>
