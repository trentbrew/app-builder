<script lang="ts">
  import SettingsField from '$lib/components/settings-field.svelte'
  import * as Select from '$lib/components/ui/select/index.js'
  import {
    EDITOR_ACTIVE_TAB_ACCENT_COLOR_OPTIONS,
    EDITOR_ACTIVE_TAB_INDICATOR_OPTIONS,
    EDITOR_CHROME_HEIGHT_OPTIONS,
  } from '$lib/settings/types'
  import { settings, updateEditorSettings } from '$lib/settings/store.svelte'

  const accentColorDisabled = $derived(settings.editor.activeTabIndicator === 'none')
</script>

<section class="settings-section">
  <header class="settings-section__header">
    <h2 class="text-sm font-medium">Editor chrome</h2>
    <p class="text-muted-foreground text-xs">Tab bars, pane toolbars, and active-tab styling across the dock.</p>
  </header>

  <div class="settings-section__body">
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
          <Select.Content>
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
          <Select.Content>
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
            )?.label ?? 'Status orange'}
          </Select.Trigger>
          <Select.Content>
            {#each EDITOR_ACTIVE_TAB_ACCENT_COLOR_OPTIONS as option (option.value)}
              <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </SettingsField>
  </div>
</section>

<style>
  .settings-section {
    border: 1px solid var(--color-border);
    border-radius: calc(var(--radius) - 2px);
    background: var(--color-background);
  }

  .settings-section__header {
    border-bottom: 1px solid var(--color-border);
    padding: 0.875rem 1rem;
  }

  .settings-section__body {
    padding-inline: 1rem;
  }
</style>
