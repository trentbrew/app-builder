<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { appChrome } from '$lib/appChrome.svelte'
</script>

<Dialog.Root bind:open={appChrome.pluginsDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Plugins</Dialog.Title>
      <Dialog.Description>Browse and install plugins for your workspace.</Dialog.Description>
    </Dialog.Header>
    <div class="text-muted-foreground py-8 text-center text-sm">No plugins installed yet.</div>
  </Dialog.Content>
</Dialog.Root>
