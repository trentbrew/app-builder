<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import SettingsForm from '$lib/components/settings-form.svelte'
  import CodeEditor from '$lib/components/code-editor.svelte'
  import { replaceSettingsFromJson, resetSettings, serializeSettings, settings } from '$lib/settings/store.svelte'
  import BracesIcon from '@lucide/svelte/icons/braces'
  import ListIcon from '@lucide/svelte/icons/list'
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'
  import SettingsIcon from '@lucide/svelte/icons/settings'

  let {
    canSplit = false,
    onSplit,
  }: {
    canSplit?: boolean
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
  } = $props()

  type ViewMode = 'ui' | 'json'

  let viewMode = $state<ViewMode>('ui')
  let jsonDraft = $state(serializeSettings())
  let jsonError = $state('')

  $effect(() => {
    settings
    if (viewMode === 'ui') {
      jsonDraft = serializeSettings()
      jsonError = ''
    }
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
</script>

<PaneChrome paneKind="settings">
  {#snippet toolbar()}
    <PaneToolbar>
      {#snippet meta()}
        <SettingsIcon class="size-3.5 shrink-0 opacity-80" />
        <span class="pane-toolbar__label">Settings</span>
        <span class="pane-toolbar__sep" aria-hidden="true"></span>
        <span class="pane-toolbar__detail">User</span>
        <span class="pane-toolbar__detail">{viewMode === 'ui' ? 'Form' : 'JSON'}</span>
      {/snippet}

      {#snippet actions()}
        <button
          type="button"
          class="pane-toolbar__btn"
          title="Reset to defaults"
          aria-label="Reset to defaults"
          onclick={resetSettings}
        >
          <RotateCcwIcon class="size-3.5" />
        </button>
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}

      {#snippet viewToggle()}
        <div class="pane-toolbar__group" role="group" aria-label="Settings view mode">
          <button
            type="button"
            class="pane-toolbar__btn"
            class:pane-toolbar__btn--active={viewMode === 'ui'}
            title="Settings UI"
            aria-pressed={viewMode === 'ui'}
            onclick={() => setViewMode('ui')}
          >
            <ListIcon class="size-3.5" />
          </button>
          <button
            type="button"
            class="pane-toolbar__btn"
            class:pane-toolbar__btn--active={viewMode === 'json'}
            title="Settings JSON"
            aria-pressed={viewMode === 'json'}
            onclick={() => setViewMode('json')}
          >
            <BracesIcon class="size-3.5" />
          </button>
        </div>
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <div class="settings-pane">
      {#if viewMode === 'ui'}
        <div class="settings-pane__scroll">
          <p class="text-muted-foreground mb-4 text-xs">Preferences are saved locally in this browser.</p>
          <SettingsForm />
        </div>
      {:else}
        <div class="settings-pane__json">
          {#if jsonError}
            <p class="settings-pane__error">{jsonError}</p>
          {/if}
          <CodeEditor path="/settings.json" content={jsonDraft} onChange={handleJsonChange} onFocus={() => {}} />
        </div>
      {/if}
    </div>
  {/snippet}
</PaneChrome>

<style>
  .settings-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-background);
  }

  .settings-pane__scroll {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
  }

  .settings-pane__json {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }

  .settings-pane__error {
    flex-shrink: 0;
    border-bottom: 1px solid color-mix(in oklch, var(--color-destructive) 35%, transparent);
    background: color-mix(in oklch, var(--color-destructive) 12%, transparent);
    color: var(--color-destructive);
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }
</style>
