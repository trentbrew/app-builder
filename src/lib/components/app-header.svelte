<script lang="ts">
  import { page } from '$app/state'
  import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import HeaderSearch from '$lib/components/header-search.svelte'
  import { appHeader } from '$lib/appHeader.svelte'
  import { cn } from '$lib/utils.js'
  import { editorChrome } from '$lib/editorChrome.svelte'

  import SettingsIcon from '@lucide/svelte/icons/settings'

  const fallbackTitle = $derived.by(() => {
    const pathname = page.url.pathname
    if (pathname === '/') return 'App Builder'
    const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'App Builder'
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
  })
</script>

<header
  class="app-header bg-background fixed inset-x-0 top-0 z-30 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(12rem,24rem)_minmax(0,1fr)] items-center gap-3 border-b px-4"
  style:height="var(--app-header-height)"
>
  <div class="min-w-0">
    {#if appHeader.breadcrumb.length}
      <Breadcrumb.Root class="min-w-0">
        <Breadcrumb.List>
          {#each appHeader.breadcrumb as part, index (index)}
            {#if index > 0}
              <Breadcrumb.Separator class="hidden md:block" />
            {/if}
            <Breadcrumb.Item class={index < appHeader.breadcrumb.length - 1 ? 'hidden md:block' : ''}>
              {#if index === appHeader.breadcrumb.length - 1}
                <Breadcrumb.Page>{part.label}</Breadcrumb.Page>
              {:else if part.href}
                <Breadcrumb.Link href={part.href}>{part.label}</Breadcrumb.Link>
              {:else}
                <Breadcrumb.Page>{part.label}</Breadcrumb.Page>
              {/if}
            </Breadcrumb.Item>
          {/each}
        </Breadcrumb.List>
      </Breadcrumb.Root>
    {:else}
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">{appHeader.title ?? fallbackTitle}</p>
        {#if appHeader.subtitle}
          <p class="text-muted-foreground truncate text-xs">{appHeader.subtitle}</p>
        {/if}
      </div>
    {/if}
  </div>

  <div class="flex justify-center px-2">
    <HeaderSearch />
  </div>

  <div class="flex shrink-0 items-center justify-end gap-2">
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Settings"
      title="Settings"
      class={cn(editorChrome.settingsOpen && 'bg-muted text-foreground')}
      onclick={() => editorChrome.toggleSettings()}
    >
      <SettingsIcon />
    </Button>
    {#each appHeader.actions as action (action.id)}
      <Button size="sm" variant={action.variant ?? 'default'} disabled={action.disabled} onclick={action.onclick}>
        {#if action.icon}
          <action.icon class="size-3.5" />
        {/if}
        {action.label}
      </Button>
    {/each}
  </div>
</header>
