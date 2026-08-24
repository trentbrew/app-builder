<script>
  import '../app.css'
  import '$lib/settings/store.svelte'
  import { Toaster } from '$lib/components/ui/sonner/index.js'
  import AppHeader from '$lib/components/app-header.svelte'
  import StatusBar from '$lib/components/status-bar.svelte'
</script>

<div class="flex h-svh w-screen flex-col">
  <AppHeader />
  <main class="app-main flex min-h-0 flex-1 flex-col pt-0">
    <AppHeader />
    <main class="app-main flex min-h-0 flex-1 flex-col pt-12">
      <slot />
    </main>
    <StatusBar />
  </main>
</div>

<Toaster richColors closeButton position="bottom-right" />

<style>
  .app-main {
    padding-bottom: var(--status-bar-height);
  }
</style>
