<script lang="ts">
  import SettingsField from '$lib/components/settings-field.svelte'
  import * as Select from '$lib/components/ui/select/index.js'
  import {
    EDITOR_ACTIVE_TAB_ACCENT_COLOR_OPTIONS,
    EDITOR_ACTIVE_TAB_INDICATOR_OPTIONS,
    EDITOR_CHROME_HEIGHT_OPTIONS,
  } from '$lib/settings/types'
  import { resetSettings, settings, updateEditorSettings } from '$lib/settings/store.svelte'
  import { clearAppHeader, setAppHeader } from '$lib/appHeader.svelte'

  const accentColorDisabled = $derived(settings.editor.activeTabIndicator === 'none')

  $effect(() => {
    setAppHeader({
      title: 'Settings',
      subtitle: 'Preferences are saved locally in this browser.',
      actions: [
        {
          id: 'reset',
          label: 'Reset defaults',
          variant: 'outline',
          onclick: resetSettings,
        },
      ],
    })

    return () => clearAppHeader()
  })
</script>

<div class="bg-background flex h-full min-h-0 flex-col">
  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
    <section class="bg-background rounded-xl border">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-medium">Editor chrome</h2>
        <p class="text-muted-foreground text-xs">Tab bars, pane toolbars, and active-tab styling across the dock.</p>
      </div>

      <div class="px-4">
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
                {EDITOR_ACTIVE_TAB_INDICATOR_OPTIONS.find(
                  (option) => option.value === settings.editor.activeTabIndicator,
                )?.label ?? 'Both'}
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
  </div>
</div>
