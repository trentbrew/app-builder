<script>
  import '../app.css'
  import '$lib/settings/store.svelte'
  import { Toaster } from '$lib/components/ui/sonner/index.js'
  import AppHeader from '$lib/components/app-header.svelte'
  import CommandPalette from '$lib/components/command-palette.svelte'
  import PluginsDialog from '$lib/components/plugins-dialog.svelte'
  import StatusBar from '$lib/components/status-bar.svelte'
</script>

<div class="app-frame flex h-svh w-screen flex-col overflow-hidden">
  <AppHeader />
  <main class="app-main flex flex-col">
    <slot />
  </main>
  <StatusBar />
  <CommandPalette />
  <PluginsDialog />
</div>

<Toaster richColors closeButton position="bottom-right" />
