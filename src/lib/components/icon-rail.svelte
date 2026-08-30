<script lang="ts">
  import { page } from '$app/state'

  import { appChrome } from '$lib/appChrome.svelte'
  import { editorChrome } from '$lib/editorChrome.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import { cn } from '$lib/utils.js'
  import type { Component } from 'svelte'

  import Code2Icon from '@lucide/svelte/icons/code-2'
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import SettingsIcon from '@lucide/svelte/icons/settings'

  type RailItem = {
    href: string
    label: string
    icon: Component
  }

  const items: RailItem[] = [
    { href: '/dashboard', label: 'Projects', icon: LayoutDashboard },
    { href: '/editor', label: 'Editor', icon: Code2Icon },
  ]

  function isActive(href: string) {
    const pathname = page.url.pathname
    if (href === '/dashboard') return pathname.startsWith('/dashboard')
    if (href === '/editor') return pathname.startsWith('/editor')
    return pathname === href || pathname.startsWith(`${href}/`)
  }
</script>

<ContextMenuHost target={{ kind: 'iconRail' }} triggerClass="icon-rail-trigger">
  <nav class="icon-rail" aria-label="Workspace projections">
    <div class="icon-rail__content">
      <div class="icon-rail__top">
        {#each items as item (item.href)}
          <a
            href={item.href}
            aria-label={item.label}
            aria-current={isActive(item.href) ? 'page' : undefined}
            title={item.label}
            class={cn('icon-rail__item', isActive(item.href) && 'icon-rail__item--active')}
          >
            <item.icon class="size-[18px]" />
          </a>
        {/each}

        <div class="bg-border my-1 h-px w-5" aria-hidden="true"></div>

        <button
          type="button"
          class="icon-rail__item"
          aria-label="Plugins"
          title="Plugins"
          onclick={() => appChrome.openPluginsDialog()}
        >
          <PlusIcon class="size-[18px] scale-75" />
        </button>
      </div>

      <div class="icon-rail__bottom">
        <button
          type="button"
          class={cn('icon-rail__item', editorChrome.settingsOpen && 'icon-rail__item--active')}
          aria-label="Settings"
          title="Settings"
          onclick={() => editorChrome.toggleSettings()}
        >
          <SettingsIcon class="size-[18px] translate-y-px" />
        </button>
      </div>
    </div>
  </nav>
</ContextMenuHost>

<style>
  :global(.icon-rail-trigger) {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    min-height: 0;
  }

  :global(:root:not([data-editor-pane-style='cards'])) .icon-rail-trigger {
    height: 100%;
  }

  .icon-rail {
    display: flex;
    width: 3rem;
    min-height: 0;
    flex-shrink: 0;
    flex-direction: column;
    align-items: stretch;
    border-right: 1px solid var(--color-border);
    background: var(--color-chrome-surface);
  }

  :global(:root:not([data-editor-pane-style='cards'])) .icon-rail {
    position: fixed;
    top: var(--app-header-height);
    bottom: var(--status-bar-height);
    left: 0;
    z-index: 20;
    height: auto;
  }

  .icon-rail__content {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding-block: 0.5rem;
  }

  .icon-rail__top,
  .icon-rail__bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .icon-rail__bottom {
    margin-top: auto;
  }

  .icon-rail__item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
    color: var(--color-muted-foreground);
    text-decoration: none;
    cursor: pointer;
    transition:
      color 120ms ease,
      background 120ms ease;
  }

  .icon-rail__item:hover {
    background: var(--color-accent);
    color: var(--color-accent-foreground);
  }

  .icon-rail__item--active {
    background: color-mix(in oklch, var(--editor-tab-active-accent, var(--color-primary)) 22%, transparent);
    color: var(--color-foreground);
  }

  .icon-rail__item--active:hover {
    background: color-mix(in oklch, var(--editor-tab-active-accent, var(--color-primary)) 28%, transparent);
    color: var(--color-foreground);
  }

  :global(:root[data-status-bar-hidden]) .icon-rail {
    bottom: 0;
  }

  :global(:root[data-editor-pane-style='cards']) .icon-rail {
    position: relative;
    top: auto;
    bottom: auto;
    left: auto;
    z-index: auto;
    flex: 1 1 auto;
    width: 3rem;
    min-height: 0;
    background: var(--color-chrome-surface);
    border: 1px solid var(--color-border);
  }
</style>
