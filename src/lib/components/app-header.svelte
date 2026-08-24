<script lang="ts">
  import { page } from '$app/state'
  import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { appHeader } from '$lib/appHeader.svelte'

  const fallbackTitle = $derived.by(() => {
    const pathname = page.url.pathname
    if (pathname === '/') return 'App Builder'
    const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'App Builder'
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
  })
</script>

<header class="bg-background fixed inset-x-0 top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b px-4">
  {#if appHeader.breadcrumb.length}
    <Breadcrumb.Root class="min-w-0 flex-1">
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
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">{appHeader.title ?? fallbackTitle}</p>
      {#if appHeader.subtitle}
        <p class="text-muted-foreground truncate text-xs">{appHeader.subtitle}</p>
      {/if}
    </div>
  {/if}

  <div class="flex shrink-0 items-center gap-2">
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
