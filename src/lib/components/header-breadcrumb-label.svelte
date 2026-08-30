<script lang="ts">
  import FileIcon from '$lib/components/file-icon.svelte'
  import type { AppHeaderBreadcrumb } from '$lib/appHeader.svelte'

  let { part }: { part: AppHeaderBreadcrumb } = $props()
</script>

<span class="inline-flex min-w-0 items-center gap-1.5 text-xs mono">
  {#if part.icon}
    <part.icon class="size-3.5 shrink-0 opacity-80" />
  {:else if part.fileIcon}
    <FileIcon path={part.fileIcon} class="size-3.5" />
  {:else if part.folderIcon}
    <FileIcon path={part.label} kind="folder" class="size-3.5" />
  {/if}
  <span class="truncate">{part.label}</span>
</span>
