<script>
  import '../app.css'
  import '$lib/settings/store.svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/state'
  import { Toaster } from '$lib/components/ui/sonner/index.js'
  import AppHeader from '$lib/components/app-header.svelte'
  import AppLogoMark from '$lib/components/app-logo-mark.svelte'
  import CommandPalette from '$lib/components/command-palette.svelte'
  import ShellShortcuts from '$lib/components/shell-shortcuts.svelte'
  import PluginsDialog from '$lib/components/plugins-dialog.svelte'
  import SettingsDialog from '$lib/components/settings-dialog.svelte'
  import StatusBar from '$lib/components/status-bar.svelte'
  import { statusBar } from '$lib/statusBar.svelte'

  const dashboardRoutes = ['/dashboard', '/templates', '/settings', '/community', '/agents', '/usage', '/profile']
  const isConnectRoute = $derived(page.url.pathname.startsWith('/webcontainer/connect'))
  const isDashboardShell = $derived(
    !isConnectRoute &&
      dashboardRoutes.some((route) => page.url.pathname === route || page.url.pathname.startsWith(`${route}/`)),
  )

  $effect(() => {
    if (!browser) return
    document.documentElement.toggleAttribute('data-status-bar-hidden', isDashboardShell || !statusBar.visible)
  })
</script>

{#if isConnectRoute}
  <slot />
{:else}
  <div class="app-frame flex h-svh w-screen flex-col overflow-hidden">
    {#if !isDashboardShell}
      <div class="app-chrome-top">
        <AppLogoMark />
        <AppHeader />
      </div>
    {/if}
    <main class="app-main flex flex-col" class:app-main--projects={isDashboardShell}>
      <slot />
    </main>
    {#if !isDashboardShell}
      <StatusBar />
    {/if}
    <CommandPalette />
    <ShellShortcuts />
    <PluginsDialog />
    <SettingsDialog />
  </div>

  <Toaster
    closeButton
    position="bottom-right"
    offset={{ bottom: 'calc(var(--status-bar-height) + 1rem)', right: '1rem' }}
    gap={12}
    visibleToasts={3}
  />
{/if}
