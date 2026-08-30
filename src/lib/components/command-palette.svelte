<script lang="ts">
  import { appChrome } from '$lib/appChrome.svelte'
  import { buildActionContext } from '$lib/actionSnapshots'
  import { groupedActionsForContext } from '$lib/appActions'
  import * as Command from '$lib/components/ui/command/index.js'

  const globalContext = $derived(buildActionContext({ kind: 'global' }))
  const grouped = $derived(groupedActionsForContext(globalContext))

  function run(actionId: string) {
    const action = grouped.flatMap((entry) => entry.actions).find((item) => item.id === actionId)
    if (!action) return
    void action.run(buildActionContext({ kind: 'global' }))
    appChrome.closeCommandPalette()
  }
</script>

<Command.Dialog bind:open={appChrome.commandPaletteOpen}>
  <Command.Input placeholder="Type a command or search..." />
  <Command.List>
    <Command.Empty>No results found.</Command.Empty>
    {#each grouped as entry, groupIndex (entry.group)}
      {#if groupIndex > 0}
        <Command.Separator />
      {/if}
      <Command.Group heading={entry.group}>
        {#each entry.actions as action (action.id)}
          <Command.Item value={`${action.group} ${action.label}`} onSelect={() => run(action.id)}>
            {#if action.icon}
              <action.icon />
            {/if}
            <span>{action.label}</span>
          </Command.Item>
        {/each}
      </Command.Group>
    {/each}
  </Command.List>
</Command.Dialog>
