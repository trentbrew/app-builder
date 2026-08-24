<script lang="ts">
  import { page } from '$app/state'

  import { cn } from '$lib/utils.js'
  import { editorChrome } from '$lib/editorChrome.svelte'
  import type { Component } from 'svelte'

  import Code2Icon from '@lucide/svelte/icons/code-2'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import SettingsIcon from '@lucide/svelte/icons/settings'

  type RailItem = {
    href: string
    label: string
    icon: Component
  }

  const items: RailItem[] = [{ href: '/editor', label: 'Editor', icon: Code2Icon }]

  function isActive(href: string) {
    const pathname = page.url.pathname
    return pathname === href || pathname.startsWith(`${href}/`)
  }
</script>

<nav class="icon-rail" aria-label="App navigation">
  <div class="flex flex-col items-center gap-1">
    {#each items as item (item.href)}
      <a
        href={item.href}
        aria-label={item.label}
        aria-current={isActive(item.href) ? 'page' : undefined}
        title={item.label}
        class={cn(
          'flex size-9 items-center justify-center rounded-md transition-colors',
          isActive(item.href)
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <item.icon class="size-[18px]" />
      </a>
    {/each}
  </div>

  <div class="mt-auto flex flex-col items-center gap-1 pt-2">
    <button
      type="button"
      class="text-muted-foreground flex size-9 items-center justify-center rounded-md opacity-40 transition-opacity hover:opacity-70"
      aria-label="New"
      title="New"
      disabled
    >
      <PlusIcon class="size-[18px] scale-75" />
    </button>
    <button
      type="button"
      aria-label="Settings"
      title="Settings"
      class={cn(
        'flex size-9 items-center justify-center rounded-md transition-colors',
        editorChrome.settingsOpen
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
      onclick={() => editorChrome.toggleSettings()}
    >
      <SettingsIcon class="size-[18px]" />
    </button>
  </div>
</nav>

<style>
  .icon-rail {
    position: fixed;
    top: var(--app-header-height);
    bottom: var(--status-bar-height);
    left: 0;
    z-index: 20;
    display: flex;
    width: 3rem;
    flex-shrink: 0;
    flex-direction: column;
    align-items: center;
    border-right: 1px solid var(--color-border);
    background: var(--color-background);
    padding-block: 0.5rem;
  }
</style>
