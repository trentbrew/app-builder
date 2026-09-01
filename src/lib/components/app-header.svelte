<script lang="ts">
  import { page } from '$app/state'
  import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import HeaderBreadcrumbLabel from '$lib/components/header-breadcrumb-label.svelte'
  import { appHeader } from '$lib/appHeader.svelte'
  import { leaveEditor, leaveEditorForDashboard } from '$lib/projects/leaveEditor'
  import { cn } from '$lib/utils.js'
  import { harnessStore, toggleAgentPanel } from '$lib/agentHarness/harnessStore.svelte'

  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import BotIcon from '@lucide/svelte/icons/bot'

  const fallbackTitle = $derived.by(() => {
    const pathname = page.url.pathname
    if (pathname === '/') return 'App Builder'
    const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'App Builder'
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
  })

  const agentPanelOpen = $derived(!harnessStore.railCollapsed)
  const onProjectsPage = $derived(page.url.pathname === '/dashboard')
</script>

<header
  class="app-header grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-4"
  style:height="var(--app-header-height)"
>
  <div class="flex shrink-0 items-center">
    {#if !onProjectsPage}
      <button
        type="button"
        class="text-muted-foreground hover:bg-muted/70 hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
        title="Back to projects"
        aria-label="Back to projects"
        onclick={() => void leaveEditorForDashboard()}
      >
        <ArrowLeftIcon class="size-4 shrink-0" />
      </button>
    {/if}
  </div>

  <div class="flex min-w-0 justify-center px-2">
    {#if appHeader.breadcrumb.length}
      <Breadcrumb.Root class="min-w-0 max-w-full">
        <Breadcrumb.List class="flex-nowrap justify-center text-muted-foreground">
          {#each appHeader.breadcrumb as part, index (index)}
            {#if index > 0}
              <Breadcrumb.Separator class="hidden md:block" />
            {/if}
            <Breadcrumb.Item class={index < appHeader.breadcrumb.length - 1 ? 'hidden md:block' : ''}>
              {#if index === appHeader.breadcrumb.length - 1}
                <Breadcrumb.Page class="text-foreground flex min-w-0 items-center">
                  <HeaderBreadcrumbLabel {part} />
                </Breadcrumb.Page>
              {:else if part.href}
                <Breadcrumb.Link
                  href={part.href}
                  class="flex min-w-0 items-center"
                  onclick={(event) => {
                    if (part.href === '/dashboard' && page.url.pathname.startsWith('/editor/')) {
                      event.preventDefault()
                      void leaveEditor(part.href)
                    }
                  }}
                >
                  <HeaderBreadcrumbLabel {part} />
                </Breadcrumb.Link>
              {:else}
                <Breadcrumb.Page class="text-foreground flex min-w-0 items-center">
                  <HeaderBreadcrumbLabel {part} />
                </Breadcrumb.Page>
              {/if}
            </Breadcrumb.Item>
          {/each}
        </Breadcrumb.List>
      </Breadcrumb.Root>
    {:else}
      <div class="min-w-0 text-center">
        <p class="truncate text-sm font-medium">{appHeader.title ?? fallbackTitle}</p>
        {#if appHeader.subtitle}
          <p class="text-muted-foreground truncate text-xs">{appHeader.subtitle}</p>
        {/if}
      </div>
    {/if}
  </div>

  <div class="flex shrink-0 items-center justify-end gap-2">
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Toggle agent panel"
      title="Agent"
      aria-expanded={agentPanelOpen}
      aria-controls="agent-pane-panel"
      class={cn(agentPanelOpen && 'bg-muted text-foreground')}
      onclick={() => toggleAgentPanel()}
    >
      <BotIcon />
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
