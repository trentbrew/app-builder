<script lang="ts">
  import SettingsField from '$lib/components/settings-field.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Slider } from '$lib/components/ui/slider/index.js'
  import { Switch } from '$lib/components/ui/switch/index.js'
  import { toast } from '$lib/notify'
  import {
    COLOR_SCHEME_OPTIONS,
    EDITOR_ACTIVE_TAB_ACCENT_COLOR_OPTIONS,
    EDITOR_ACTIVE_TAB_INDICATOR_OPTIONS,
    EDITOR_CHROME_HEIGHT_OPTIONS,
    EDITOR_LAYOUT_PRESET_OPTIONS,
    EDITOR_MARKDOWN_PROPERTIES_LAYOUT_OPTIONS,
    EDITOR_PANE_GAP_MAX,
    EDITOR_PANE_GAP_MIN,
    EDITOR_PANE_STYLE_OPTIONS,
    FONT_SIZE_MAX,
    FONT_SIZE_MIN,
  } from '$lib/settings/types'
  import { fieldIsVisible, SETTINGS_SECTIONS, visibleSections, type SettingSectionId } from '$lib/settings/sections'
  import {
    importThemeFromTweakcn,
    settings,
    updateEditorSettings,
    updateThemeSettings,
    updateTypographySettings,
  } from '$lib/settings/store.svelte'
  import { THEME_PRESETS } from '$lib/theme'
  import { actionRunner } from '$lib/actionRunner.svelte'

  let {
    activeSection = null,
    searchQuery = '',
  }: {
    activeSection?: SettingSectionId | null
    searchQuery?: string
  } = $props()

  const accentColorDisabled = $derived(settings.editor.activeTabIndicator === 'none')
  const cardsMode = $derived(settings.editor.paneStyle === 'cards')
  const themePresetOptions = $derived(
    settings.theme.presetId === 'custom'
      ? [
          ...THEME_PRESETS,
          { id: 'custom', name: settings.theme.custom?.name ?? 'Custom', description: 'Imported from tweakcn' },
        ]
      : THEME_PRESETS,
  )
  const searching = $derived(Boolean(searchQuery.trim()))
  const sectionsToRender = $derived(searching ? visibleSections(searchQuery) : activeSection ? [] : SETTINGS_SECTIONS)

  function showField(fieldId: Parameters<typeof fieldIsVisible>[0]) {
    return fieldIsVisible(fieldId, searching ? null : activeSection, searchQuery)
  }

  function sectionMeta(id: SettingSectionId) {
    return SETTINGS_SECTIONS.find((section) => section.id === id)!
  }

  function applyLayoutPresetToWorkspace() {
    const applied = actionRunner.applyLayoutPreset(settings.editor.layoutPreset)
    if (applied) {
      toast.success('Applied layout preset')
      return
    }
    toast.error('Open a project editor to apply a layout preset')
  }

  async function importThemeFromClipboard() {
    try {
      const raw = await navigator.clipboard.readText()
      const result = importThemeFromTweakcn(raw)
      if (result.ok) {
        toast.success(`Applied theme “${result.name}”`)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Could not read clipboard')
    }
  }
</script>

{#if !searching && activeSection}
  {@const meta = sectionMeta(activeSection)}
  <header class="settings-prose--group" data-component="settings-prose">
    <h1>{meta.label}</h1>
    <p>{meta.description}</p>
  </header>
{/if}

{#if searching && sectionsToRender.length === 0}
  <p class="text-muted-foreground py-8 text-center text-sm">No settings match “{searchQuery.trim()}”.</p>
{/if}

{#snippet themeFields()}
  {#if showField('color-scheme')}
    <SettingsField label="Color scheme" description="Dark is the default studio look; system follows your OS.">
      {#snippet control()}
        <Select.Root
          type="single"
          value={settings.theme.colorScheme}
          onValueChange={(value) => {
            if (value) updateThemeSettings({ colorScheme: value as typeof settings.theme.colorScheme })
          }}
        >
          <Select.Trigger class="w-full min-w-[12rem]">
            {COLOR_SCHEME_OPTIONS.find((option) => option.value === settings.theme.colorScheme)?.label ?? 'Dark'}
          </Select.Trigger>
          <Select.Content class="max-h-[300px]">
            {#each COLOR_SCHEME_OPTIONS as option (option.value)}
              <Select.Item value={option.value} label={option.label}>
                <div class="flex flex-col gap-0.5">
                  <span>{option.label}</span>
                  <span class="text-muted-foreground text-xs">{option.description}</span>
                </div>
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('theme-preset')}
    <SettingsField label="Theme preset" description="Built-in palettes compatible with tweakcn exports.">
      {#snippet control()}
        <Select.Root
          type="single"
          value={settings.theme.presetId}
          onValueChange={(value) => {
            if (value && value !== 'custom') updateThemeSettings({ presetId: value, custom: undefined })
          }}
        >
          <Select.Trigger class="w-full min-w-[12rem]">
            {themePresetOptions.find((option) => option.id === settings.theme.presetId)?.name ?? 'Trellis Studio'}
          </Select.Trigger>
          <Select.Content class="max-h-[300px]">
            {#each themePresetOptions as option (option.id)}
              <Select.Item value={option.id} label={option.name}>
                <div class="flex flex-col gap-0.5">
                  <span>{option.name}</span>
                  {#if option.description}
                    <span class="text-muted-foreground text-xs">{option.description}</span>
                  {/if}
                </div>
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('import-tweakcn')}
    <SettingsField label="Import tweakcn theme" description="Paste a registry JSON export from the clipboard.">
      {#snippet control()}
        <button type="button" class="settings-import-btn" onclick={importThemeFromClipboard}>
          Import from clipboard
        </button>
      {/snippet}
    </SettingsField>
  {/if}
{/snippet}

{#snippet editorFields()}
  {#if showField('chrome-height')}
    <SettingsField label="Chrome row height" description="Shared height for tab bars and pane detail rows.">
      {#snippet control()}
        <Select.Root
          type="single"
          value={settings.editor.chromeHeight}
          onValueChange={(value) => {
            if (value) updateEditorSettings({ chromeHeight: value as typeof settings.editor.chromeHeight })
          }}
        >
          <Select.Trigger class="w-full min-w-[12rem]">
            {EDITOR_CHROME_HEIGHT_OPTIONS.find((option) => option.value === settings.editor.chromeHeight)?.label ??
              'Default'}
          </Select.Trigger>
          <Select.Content class="max-h-[300px]">
            {#each EDITOR_CHROME_HEIGHT_OPTIONS as option (option.value)}
              <Select.Item value={option.value} label={option.label}>
                <div class="flex flex-col gap-0.5">
                  <span>{option.label}</span>
                  <span class="text-muted-foreground text-xs">{option.description}</span>
                </div>
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('active-tab-highlight')}
    <SettingsField label="Active tab highlight" description="How the selected tab is emphasized in each pane.">
      {#snippet control()}
        <Select.Root
          type="single"
          value={settings.editor.activeTabIndicator}
          onValueChange={(value) => {
            if (value)
              updateEditorSettings({
                activeTabIndicator: value as typeof settings.editor.activeTabIndicator,
              })
          }}
        >
          <Select.Trigger class="w-full min-w-[12rem]">
            {EDITOR_ACTIVE_TAB_INDICATOR_OPTIONS.find((option) => option.value === settings.editor.activeTabIndicator)
              ?.label ?? 'Both'}
          </Select.Trigger>
          <Select.Content class="max-h-[300px]">
            {#each EDITOR_ACTIVE_TAB_INDICATOR_OPTIONS as option (option.value)}
              <Select.Item value={option.value} label={option.label}>
                <div class="flex flex-col gap-0.5">
                  <span>{option.label}</span>
                  <span class="text-muted-foreground text-xs">{option.description}</span>
                </div>
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('pane-style')}
    <SettingsField
      label="Rounded pane cards"
      description="Separate panes with small gaps and rounded corners instead of edge-to-edge splits."
    >
      {#snippet control()}
        <Select.Root
          type="single"
          value={settings.editor.paneStyle}
          onValueChange={(value) => {
            if (value) updateEditorSettings({ paneStyle: value as typeof settings.editor.paneStyle })
          }}
        >
          <Select.Trigger class="w-full min-w-[12rem]">
            {EDITOR_PANE_STYLE_OPTIONS.find((option) => option.value === settings.editor.paneStyle)?.label ?? 'Flush'}
          </Select.Trigger>
          <Select.Content class="max-h-[300px]">
            {#each EDITOR_PANE_STYLE_OPTIONS as option (option.value)}
              <Select.Item value={option.value} label={option.label}>
                <div class="flex flex-col gap-0.5">
                  <span>{option.label}</span>
                  <span class="text-muted-foreground text-xs">{option.description}</span>
                </div>
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('layout-preset')}
    <SettingsField
      label="Layout preset"
      description="Default dock arrangement for new projects. Apply to rearrange the current workspace."
    >
      {#snippet control()}
        <div class="flex w-full min-w-[12rem] flex-col gap-2">
          <Select.Root
            type="single"
            value={settings.editor.layoutPreset}
            onValueChange={(value) => {
              if (value) updateEditorSettings({ layoutPreset: value as typeof settings.editor.layoutPreset })
            }}
          >
            <Select.Trigger class="w-full">
              {EDITOR_LAYOUT_PRESET_OPTIONS.find((option) => option.value === settings.editor.layoutPreset)
                ?.label ?? 'Classic'}
            </Select.Trigger>
            <Select.Content class="max-h-[300px]">
              {#each EDITOR_LAYOUT_PRESET_OPTIONS as option (option.value)}
                <Select.Item value={option.value} label={option.label}>
                  <div class="flex flex-col gap-0.5">
                    <span>{option.label}</span>
                    <span class="text-muted-foreground text-xs">{option.description}</span>
                  </div>
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <Button type="button" variant="outline" class="w-full" onclick={applyLayoutPresetToWorkspace}>
            Apply to current workspace
          </Button>
        </div>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('pane-gap')}
    <SettingsField label="Pane gap" description="Space between card panes, icon rail, header, and status bar.">
      {#snippet control()}
        <div class="flex w-full min-w-[12rem] flex-col gap-2">
          <div class="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
            <span>{EDITOR_PANE_GAP_MIN}px</span>
            <span class="text-foreground font-medium">{settings.editor.paneGap}px</span>
            <span>{EDITOR_PANE_GAP_MAX}px</span>
          </div>
          <Slider
            type="single"
            value={settings.editor.paneGap}
            min={EDITOR_PANE_GAP_MIN}
            max={EDITOR_PANE_GAP_MAX}
            step={1}
            disabled={!cardsMode}
            onValueChange={(value) => {
              if (typeof value === 'number') updateEditorSettings({ paneGap: value })
            }}
          />
        </div>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('active-tab-accent')}
    <SettingsField label="Active tab accent color" description="Color used for the top accent and background tint.">
      {#snippet control()}
        <Select.Root
          type="single"
          value={settings.editor.activeTabAccentColor}
          disabled={accentColorDisabled}
          onValueChange={(value) => {
            if (value)
              updateEditorSettings({
                activeTabAccentColor: value as typeof settings.editor.activeTabAccentColor,
              })
          }}
        >
          <Select.Trigger class="w-full min-w-[12rem]" disabled={accentColorDisabled}>
            {EDITOR_ACTIVE_TAB_ACCENT_COLOR_OPTIONS.find(
              (option) => option.value === settings.editor.activeTabAccentColor,
            )?.label ?? 'Theme primary'}
          </Select.Trigger>
          <Select.Content class="max-h-[300px]">
            {#each EDITOR_ACTIVE_TAB_ACCENT_COLOR_OPTIONS as option (option.value)}
              <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('stretch-single-tabs')}
    <SettingsField
      label="Stretch single tabs"
      description="When a pane has only one tab, expand it to fill the tab bar width."
    >
      {#snippet control()}
        <div class="flex items-center justify-end">
          <Switch
            checked={settings.editor.stretchSingleTabs}
            onCheckedChange={(value) => updateEditorSettings({ stretchSingleTabs: value })}
            aria-label="Stretch single tabs"
          />
        </div>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('keep-empty-panes')}
    <SettingsField
      label="Keep empty panes"
      description="When the last tab in a pane is closed, keep the pane with a blank state instead of removing it."
    >
      {#snippet control()}
        <div class="flex items-center justify-end">
          <Switch
            checked={settings.editor.keepEmptyPanes}
            onCheckedChange={(value) => updateEditorSettings({ keepEmptyPanes: value })}
            aria-label="Keep empty panes"
          />
        </div>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('auto-save-sandbox')}
    <SettingsField
      label="Auto-save to sandbox"
      description="Push code edits to the sandbox as you type. Cmd+S still saves when this is off."
    >
      {#snippet control()}
        <div class="flex items-center justify-end">
          <Switch
            checked={settings.editor.autoSaveToSandbox}
            onCheckedChange={(value) => updateEditorSettings({ autoSaveToSandbox: value })}
            aria-label="Auto-save to sandbox"
          />
        </div>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('markdown-properties')}
    <SettingsField
      label="Markdown properties"
      description="Where YAML frontmatter fields appear when editing markdown in rich mode."
    >
      {#snippet control()}
        <Select.Root
          type="single"
          value={settings.editor.markdownPropertiesLayout}
          onValueChange={(value) => {
            if (value)
              updateEditorSettings({
                markdownPropertiesLayout: value as typeof settings.editor.markdownPropertiesLayout,
              })
          }}
        >
          <Select.Trigger class="w-full min-w-[12rem]">
            {EDITOR_MARKDOWN_PROPERTIES_LAYOUT_OPTIONS.find(
              (option) => option.value === settings.editor.markdownPropertiesLayout,
            )?.label ?? 'Sidebar'}
          </Select.Trigger>
          <Select.Content class="max-h-[300px]">
            {#each EDITOR_MARKDOWN_PROPERTIES_LAYOUT_OPTIONS as option (option.value)}
              <Select.Item value={option.value} label={option.label}>
                <div class="flex flex-col gap-0.5">
                  <span>{option.label}</span>
                  <span class="text-muted-foreground text-xs">{option.description}</span>
                </div>
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  {/if}
{/snippet}

{#snippet typographyFields()}
  {#if showField('editor-font-size')}
    <SettingsField label="Editor font size" description="Code editor and settings JSON view.">
      {#snippet control()}
        <div class="flex w-full min-w-[12rem] flex-col gap-2">
          <div class="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
            <span>{FONT_SIZE_MIN}px</span>
            <span class="text-foreground font-medium">{settings.typography.editorFontSize}px</span>
            <span>{FONT_SIZE_MAX}px</span>
          </div>
          <Slider
            type="single"
            value={settings.typography.editorFontSize}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            onValueChange={(value) => {
              if (typeof value === 'number') updateTypographySettings({ editorFontSize: value })
            }}
          />
        </div>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('terminal-font-size')}
    <SettingsField
      label="Terminal font size"
      description="Integrated terminal, server logs, and preview JS console. Defaults to match the editor."
    >
      {#snippet control()}
        <div class="flex w-full min-w-[12rem] flex-col gap-2">
          <div class="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
            <span>{FONT_SIZE_MIN}px</span>
            <span class="text-foreground font-medium">{settings.typography.terminalFontSize}px</span>
            <span>{FONT_SIZE_MAX}px</span>
          </div>
          <Slider
            type="single"
            value={settings.typography.terminalFontSize}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            onValueChange={(value) => {
              if (typeof value === 'number') updateTypographySettings({ terminalFontSize: value })
            }}
          />
        </div>
      {/snippet}
    </SettingsField>
  {/if}

  {#if showField('explorer-font-size')}
    <SettingsField label="Explorer font size" description="File tree rows and section labels in the sidebar explorer.">
      {#snippet control()}
        <div class="flex w-full min-w-[12rem] flex-col gap-2">
          <div class="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
            <span>{FONT_SIZE_MIN}px</span>
            <span class="text-foreground font-medium">{settings.typography.explorerFontSize}px</span>
            <span>{FONT_SIZE_MAX}px</span>
          </div>
          <Slider
            type="single"
            value={settings.typography.explorerFontSize}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            onValueChange={(value) => {
              if (typeof value === 'number') updateTypographySettings({ explorerFontSize: value })
            }}
          />
        </div>
      {/snippet}
    </SettingsField>
  {/if}
{/snippet}

{#snippet sectionBody(sectionId: SettingSectionId)}
  <div class="settings-form__section-body">
    {#if sectionId === 'theme'}
      {@render themeFields()}
    {:else if sectionId === 'editor'}
      {@render editorFields()}
    {:else}
      {@render typographyFields()}
    {/if}
  </div>
{/snippet}

{#if searching}
  {#each sectionsToRender as section (section.id)}
    <section class="settings-form__group">
      <header class="settings-prose--group" data-component="settings-prose">
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </header>
      {@render sectionBody(section.id)}
    </section>
  {/each}
{:else if activeSection}
  {@render sectionBody(activeSection)}
{:else}
  {#each SETTINGS_SECTIONS as section (section.id)}
    <section class="settings-form__group">
      <header class="settings-prose--group" data-component="settings-prose">
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </header>
      {@render sectionBody(section.id)}
    </section>
  {/each}
{/if}

<style>
  .settings-form__group + .settings-form__group {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
  }

  .settings-form__section-body {
    padding-inline: 0.125rem;
  }

  :global(.settings-import-btn) {
    border: 1px solid var(--color-border);
    border-radius: calc(var(--radius) - 4px);
    background: var(--color-secondary);
    color: var(--color-secondary-foreground);
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    transition: background-color 0.15s ease;
  }

  :global(.settings-import-btn:hover) {
    background: color-mix(in oklch, var(--color-muted) 70%, transparent);
  }
</style>
