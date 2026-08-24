<script>
  import '../app.css'
  import '$lib/settings/store.svelte'
  import { Toaster } from '$lib/components/ui/sonner/index.js'
  import AppHeader from '$lib/components/app-header.svelte'
  import StatusBar from '$lib/components/status-bar.svelte'
</script>

<div class="flex h-svh w-screen flex-col overflow-hidden">
  <AppHeader />
  <main class="app-main flex flex-col">
    <slot />
  </main>
  <StatusBar />
</div>

<Toaster richColors closeButton position="bottom-right" />
