<script lang="ts">
  import type { Snippet } from 'svelte'
  import DashboardSidebar from '$lib/components/dashboard-sidebar.svelte'
  import AppLogoMark from '$lib/components/app-logo-mark.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar/index.js'

  let { children }: { children: Snippet } = $props()
</script>

<div class="dashboard-shell relative flex min-h-0 min-w-0 flex-1">
  <div class="dashboard-shell__logo">
    <AppLogoMark />
  </div>

  <Sidebar.Provider class="flex min-h-0 min-w-0 flex-1">
    <DashboardSidebar />
    <Sidebar.Inset
      class="dashboard-shell__main border-border bg-background m-2 ml-0 overflow-auto rounded-xl border shadow-sm"
    >
      {@render children()}
    </Sidebar.Inset>
  </Sidebar.Provider>
</div>

<style>
  .dashboard-shell {
    min-height: 0;
    background: var(--color-background);
  }

  .dashboard-shell__logo {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 30;
  }

  .dashboard-shell__logo :global(.app-logo-mark) {
    width: 2.25rem;
    height: 2.25rem;
    background: transparent;
  }

  .dashboard-shell__main {
    min-height: 0;
  }

  @media (min-width: 768px) {
    .dashboard-shell__main {
      margin-left: 0;
      min-height: calc(100% - 1rem);
    }
  }
</style>
