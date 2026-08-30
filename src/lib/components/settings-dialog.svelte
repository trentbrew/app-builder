<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import SettingsForm from '$lib/components/settings-form.svelte'
  import CodeEditor from '$lib/components/code-editor.svelte'
  import { Input } from '$lib/components/ui/input/index.js'
  import { editorChrome } from '$lib/editorChrome.svelte'
  import { replaceSettingsFromJson, serializeSettings, settings } from '$lib/settings/store.svelte'
  import { sectionHasVisibleFields, SETTINGS_SECTIONS, type SettingSectionId } from '$lib/settings/sections'
  import { cn } from '$lib/utils.js'
  import BracesIcon from '@lucide/svelte/icons/braces'
  import ListIcon from '@lucide/svelte/icons/list'
  import SearchIcon from '@lucide/svelte/icons/search'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import XIcon from '@lucide/svelte/icons/x'

  type ViewMode = 'ui' | 'json'

  const DEFAULT_SIZE_RATIO = 0.5
  const MIN_DIALOG_WIDTH = 352
  const MIN_DIALOG_HEIGHT = 288
  const DIALOG_MARGIN = 32

  let viewMode = $state<ViewMode>('ui')
  let activeSection = $state<SettingSectionId>('theme')
  let searchQuery = $state('')
  let jsonDraft = $state(serializeSettings())
  let jsonError = $state('')
  let dialogWidth = $state(0)
  let dialogHeight = $state(0)
  let isResizing = $state(false)

  const searching = $derived(Boolean(searchQuery.trim()))
  const dialogStyle = $derived(
    dialogWidth && dialogHeight ? `width:${dialogWidth}px;height:${dialogHeight}px;` : undefined,
  )

  function defaultDialogSize() {
    return clampDialogSize(
      Math.round(window.innerWidth * DEFAULT_SIZE_RATIO),
      Math.round(window.innerHeight * DEFAULT_SIZE_RATIO),
    )
  }

  function clampDialogSize(width: number, height: number) {
    const maxWidth = window.innerWidth - DIALOG_MARGIN
    const maxHeight = window.innerHeight - DIALOG_MARGIN
    return {
      width: Math.min(Math.max(width, MIN_DIALOG_WIDTH), maxWidth),
      height: Math.min(Math.max(height, MIN_DIALOG_HEIGHT), maxHeight),
    }
  }

  function ensureDialogSize() {
    if (dialogWidth && dialogHeight) return
    const size = defaultDialogSize()
    dialogWidth = size.width
    dialogHeight = size.height
  }

  function startResize(event: PointerEvent) {
    event.preventDefault()
    ensureDialogSize()
    isResizing = true

    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)

    const startX = event.clientX
    const startY = event.clientY
    const startWidth = dialogWidth
    const startHeight = dialogHeight

    const onMove = (moveEvent: PointerEvent) => {
      const next = clampDialogSize(
        startWidth + (moveEvent.clientX - startX),
        startHeight + (moveEvent.clientY - startY),
      )
      dialogWidth = next.width
      dialogHeight = next.height
    }

    const onUp = (upEvent: PointerEvent) => {
      isResizing = false
      if (handle.hasPointerCapture(upEvent.pointerId)) {
        handle.releasePointerCapture(upEvent.pointerId)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  $effect(() => {
    settings
    if (viewMode === 'ui') {
      jsonDraft = serializeSettings()
      jsonError = ''
    }
  })

  $effect(() => {
    if (editorChrome.settingsOpen) {
      ensureDialogSize()
      return
    }

    viewMode = 'ui'
    activeSection = 'theme'
    searchQuery = ''
  })

  function setViewMode(mode: ViewMode) {
    if (mode === 'json') {
      jsonDraft = serializeSettings()
      jsonError = ''
    }
    viewMode = mode
  }

  function handleJsonChange(content: string) {
    jsonDraft = content
    const result = replaceSettingsFromJson(content)
    jsonError = result.ok ? '' : result.error
  }

  function selectSection(sectionId: SettingSectionId) {
    activeSection = sectionId
    searchQuery = ''
  }
</script>

<Dialog.Root bind:open={editorChrome.settingsOpen}>
  <Dialog.Content
    class={cn(
      'settings-dialog !fixed !inset-0 !m-auto !max-h-[calc(100vh-2rem)] !max-w-[calc(100vw-2rem)] !translate-none !p-0 !gap-0 !ring-0 data-open:!zoom-in-100 data-closed:!zoom-out-100',
      isResizing && 'settings-dialog--resizing',
    )}
    style={dialogStyle}
    showCloseButton={false}
  >
    <div class="settings-dialog__pane">
      <div class="settings-dialog__tab-bar" role="tablist" aria-label="Settings pane">
        <div class="settings-dialog__tab settings-dialog__tab--active" role="tab" aria-selected="true">
          <SettingsIcon class="size-3.5 shrink-0 opacity-80" />
          <span class="settings-dialog__tab-title">Settings</span>
        </div>

        <div class="settings-dialog__tab-spacer" aria-hidden="true"></div>

        <button
          type="button"
          class="settings-dialog__tab-close"
          aria-label="Close settings"
          onclick={() => editorChrome.closeSettings()}
        >
          <XIcon class="size-3.5" />
        </button>
      </div>

      <div class="settings-dialog__toolbar">
        {#if viewMode === 'ui'}
          <div class="settings-dialog__toolbar-search">
            <SearchIcon
              class="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
            />
            <Input
              class="settings-dialog__toolbar-search-input h-7 w-full min-w-0 rounded-none border-0 bg-transparent pl-7 text-xs shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
              type="search"
              placeholder="Search settings…"
              bind:value={searchQuery}
              aria-label="Search settings"
            />
          </div>
        {:else}
          <div class="settings-dialog__toolbar-spacer" aria-hidden="true"></div>
        {/if}

        <div class="settings-dialog__view-tabs" role="group" aria-label="Settings view mode">
          <button
            type="button"
            class="settings-dialog__view-tab"
            class:settings-dialog__view-tab--active={viewMode === 'ui'}
            title="Settings UI"
            aria-pressed={viewMode === 'ui'}
            onclick={() => setViewMode('ui')}
          >
            <ListIcon class="size-3.5" />
          </button>
          <button
            type="button"
            class="settings-dialog__view-tab"
            class:settings-dialog__view-tab--active={viewMode === 'json'}
            title="Settings JSON"
            aria-pressed={viewMode === 'json'}
            onclick={() => setViewMode('json')}
          >
            <BracesIcon class="size-3.5" />
          </button>
        </div>
      </div>

      {#if viewMode === 'ui'}
        <div class="settings-dialog__body">
          <aside class="settings-dialog__sidebar">
            <nav class="settings-dialog__nav" aria-label="Settings sections">
              {#each SETTINGS_SECTIONS as section (section.id)}
                {@const hasMatches = searching ? sectionHasVisibleFields(section.id, searchQuery) : true}
                {#if hasMatches}
                  <button
                    type="button"
                    class={cn(
                      'settings-dialog__nav-item',
                      !searching && activeSection === section.id && 'settings-dialog__nav-item--active',
                    )}
                    aria-current={!searching && activeSection === section.id ? 'page' : undefined}
                    onclick={() => selectSection(section.id)}
                  >
                    {section.label}
                  </button>
                {/if}
              {/each}
            </nav>
          </aside>

          <div class="settings-dialog__main">
            <div class="settings-dialog__scroll">
              <SettingsForm {activeSection} {searchQuery} />
            </div>
          </div>
        </div>
      {:else}
        <div class="settings-dialog__json">
          {#if jsonError}
            <p class="settings-dialog__error">{jsonError}</p>
          {/if}
          <div class="settings-dialog__json-editor">
            <CodeEditor path="/settings.json" content={jsonDraft} onChange={handleJsonChange} onFocus={() => {}} />
          </div>
        </div>
      {/if}
    </div>

    <button
      type="button"
      class="settings-dialog__resize-handle"
      aria-label="Resize settings window"
      onpointerdown={startResize}
    ></button>
  </Dialog.Content>
</Dialog.Root>

<style>
  .settings-dialog__pane {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    background: var(--color-background);
  }

  .settings-dialog__tab-bar {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: var(--editor-chrome-height, 2rem);
    min-height: var(--editor-chrome-height, 2rem);
    padding-top: 1px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background);
    box-sizing: border-box;
  }

  .settings-dialog__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 100%;
    padding: 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-foreground);
    background: transparent;
    box-shadow: none;
  }

  .settings-dialog__tab-title {
    font-weight: 500;
    line-height: 1;
  }

  .settings-dialog__tab-spacer {
    flex: 1 1 auto;
    min-width: 0;
  }

  .settings-dialog__tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 100%;
    border: none;
    border-left: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
    transition:
      color 120ms ease,
      background 120ms ease;
  }

  .settings-dialog__tab-close:hover {
    color: var(--color-foreground);
    background: color-mix(in oklch, var(--color-muted) 45%, transparent);
  }

  .settings-dialog__body {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .settings-dialog__sidebar {
    display: flex;
    flex-direction: column;
    flex: 0 0 9.5rem;
    min-height: 0;
    border-right: 1px solid var(--color-border);
    background: color-mix(in oklch, var(--color-muted) 10%, var(--color-background));
  }

  .settings-dialog__nav {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .settings-dialog__nav-item {
    width: 100%;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
    padding: 0.4375rem 0.625rem;
    text-align: left;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-muted-foreground);
    cursor: pointer;
    transition:
      color 120ms ease,
      background 120ms ease;
  }

  .settings-dialog__nav-item:hover {
    color: var(--color-foreground);
    background: color-mix(in oklch, var(--color-muted) 40%, transparent);
  }

  .settings-dialog__nav-item--active {
    color: var(--color-foreground);
    background: color-mix(in oklch, var(--color-muted) 35%, var(--color-background));
  }

  .settings-dialog__toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    height: var(--editor-chrome-height, 2rem);
    min-height: var(--editor-chrome-height, 2rem);
    padding: 0;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-background);
    box-sizing: border-box;
  }

  .settings-dialog__toolbar-spacer {
    flex: 1 1 auto;
    min-width: 0;
  }

  .settings-dialog__toolbar-search {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }

  .settings-dialog__toolbar-search-input {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .settings-dialog__view-tabs {
    display: inline-flex;
    align-items: stretch;
    align-self: stretch;
    flex: 0 0 auto;
    height: 100%;
  }

  .settings-dialog__view-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
    padding: 0;
    transition:
      color 120ms ease,
      background 120ms ease;
  }

  .settings-dialog__view-tab:hover {
    color: var(--color-foreground);
    background: color-mix(in oklch, var(--color-muted) 45%, transparent);
  }

  .settings-dialog__view-tab--active {
    color: var(--color-foreground);
    border-bottom: 2px solid var(--color-foreground);
    margin-bottom: -1px;
  }

  :global([data-slot='dialog-content'].settings-dialog.settings-dialog--resizing),
  :global([data-slot='dialog-content'].settings-dialog.settings-dialog--resizing *) {
    transition: none !important;
    animation: none !important;
  }

  .settings-dialog__main {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--color-background);
  }

  .settings-dialog__scroll {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem 1.25rem 1.5rem;
  }

  .settings-dialog__json {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    font-family: var(--font-mono);
  }

  .settings-dialog__json-editor {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }

  .settings-dialog__json-editor :global(.cm-editor) {
    height: 100%;
  }

  .settings-dialog__error {
    flex-shrink: 0;
    border-bottom: 1px solid color-mix(in oklch, var(--color-destructive) 35%, transparent);
    background: color-mix(in oklch, var(--color-destructive) 12%, transparent);
    color: var(--color-destructive);
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }

  .settings-dialog__resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 10;
    width: 1.25rem;
    height: 1.25rem;
    border: none;
    background: transparent;
    cursor: nwse-resize;
    touch-action: none;
  }

  .settings-dialog__resize-handle::after {
    content: '';
    position: absolute;
    right: 3px;
    bottom: 3px;
    width: 10px;
    height: 10px;
    border-right: 2px solid color-mix(in oklch, var(--color-muted-foreground) 55%, transparent);
    border-bottom: 2px solid color-mix(in oklch, var(--color-muted-foreground) 55%, transparent);
    pointer-events: none;
  }
</style>
