<script lang="ts">
  import * as Sidebar from '$lib/components/ui/sidebar/index.js'
  import FileExplorer from '$lib/components/file-explorer.svelte'
  import type { ComponentProps } from 'svelte'

  interface Props extends ComponentProps<typeof Sidebar.Root> {
    activeFile?: string
    onSelectFile?: (path: string, content: string) => void
  }

  let { ref = $bindable(null), activeFile = '/App.svelte', onSelectFile, ...restProps }: Props = $props()
</script>

<Sidebar.Root bind:ref {...restProps}>
  <Sidebar.Content class="p-0">
    <FileExplorer {activeFile} {onSelectFile} />
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
