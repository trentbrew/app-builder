<script lang="ts">
  import { page } from '$app/state'

  import { appChrome } from '$lib/appChrome.svelte'
  import ContextMenuHost from '$lib/components/context-menu-host.svelte'
  import { cn } from '$lib/utils.js'
  import type { Component } from 'svelte'

  import Code2Icon from '@lucide/svelte/icons/code-2'
  import PlusIcon from '@lucide/svelte/icons/plus'

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

<ContextMenuHost target={{ kind: 'iconRail' }} triggerClass="icon-rail-trigger">
  <nav class="icon-rail" aria-label="Workspace projections">
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

      <div class="bg-border my-1 h-px w-5" aria-hidden="true"></div>

      <button
        type="button"
        class="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex size-9 items-center justify-center rounded-md transition-colors"
        aria-label="Plugins"
        title="Plugins"
        onclick={() => appChrome.openPluginsDialog()}
      >
        <PlusIcon class="size-[18px] scale-75" />
      </button>
    </div>
  </nav>
</ContextMenuHost>

<style>
  :global(.icon-rail-trigger) {
    display: block;
    height: 100%;
  }

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

  :global(:root[data-status-bar-hidden]) .icon-rail {
    bottom: 0;
  }
</style>
