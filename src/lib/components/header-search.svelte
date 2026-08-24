<script lang="ts">
  import { appChrome } from '$lib/appChrome.svelte'
  import { Kbd } from '$lib/components/ui/kbd/index.js'
  import SearchIcon from '@lucide/svelte/icons/search'
</script>

<button
  type="button"
  class="bg-muted/40 hover:bg-muted/70 border-input text-muted-foreground focus-visible:ring-ring/50 flex h-8 w-full max-w-md items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none"
  aria-label="Open command palette"
  title="Search (⌘K)"
  onclick={() => appChrome.openCommandPalette()}
>
  <SearchIcon class="size-3.5 shrink-0 opacity-60" />
  <span class="truncate">Search commands...</span>
  <span class="ml-auto flex shrink-0 items-center gap-0.5">
    <Kbd>⌘</Kbd>
    <Kbd>K</Kbd>
  </span>
</button>
