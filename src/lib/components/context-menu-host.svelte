<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { ActionTarget } from '$lib/actionContext'
  import { buildActionContext } from '$lib/actionSnapshots'
  import { groupedActionsForContext } from '$lib/appActions'
  import * as ContextMenu from '$lib/components/ui/context-menu/index.js'

  let {
    target,
    children,
    triggerClass = '',
    contentClass = 'w-52',
    disabled = false,
  }: {
    target: ActionTarget
    children?: Snippet
    triggerClass?: string
    contentClass?: string
    disabled?: boolean
  } = $props()

  const ctx = $derived(buildActionContext(target))
  const grouped = $derived(groupedActionsForContext(ctx))
  const editActions = $derived(grouped.find((entry) => entry.group === 'Edit')?.actions ?? [])
  const topGroups = $derived(grouped.filter((entry) => entry.group !== 'Edit'))
  const hasMenu = $derived(grouped.length > 0)

  async function runAction(actionId: string) {
    const action = grouped.flatMap((entry) => entry.actions).find((item) => item.id === actionId)
    if (!action) return
    await action.run(buildActionContext(target))
  }
</script>

{#if disabled || !hasMenu}
  {@render children?.()}
{:else}
  <ContextMenu.Root>
    <ContextMenu.Trigger class={triggerClass}>
      {@render children?.()}
    </ContextMenu.Trigger>
    <ContextMenu.Content class={contentClass}>
      {#each topGroups as entry, groupIndex (entry.group)}
        {#if groupIndex > 0}
          <ContextMenu.Separator />
        {/if}
        <ContextMenu.Group>
          <ContextMenu.GroupHeading>{entry.group}</ContextMenu.GroupHeading>
          {#each entry.actions as action (action.id)}
            <ContextMenu.Item onclick={() => void runAction(action.id)}>
              {#if action.icon}
                <action.icon />
              {/if}
              <span>{action.label}</span>
              {#if action.shortcut}
                <ContextMenu.Shortcut>{action.shortcut}</ContextMenu.Shortcut>
              {/if}
            </ContextMenu.Item>
          {/each}
        </ContextMenu.Group>
      {/each}

      {#if editActions.length}
        {#if topGroups.length}
          <ContextMenu.Separator />
        {/if}
        <ContextMenu.Sub>
          <ContextMenu.SubTrigger>Edit</ContextMenu.SubTrigger>
          <ContextMenu.SubContent class={contentClass}>
            {#each editActions as action (action.id)}
              <ContextMenu.Item onclick={() => void runAction(action.id)}>
                {#if action.icon}
                  <action.icon />
                {/if}
                <span>{action.label}</span>
                {#if action.shortcut}
                  <ContextMenu.Shortcut>{action.shortcut}</ContextMenu.Shortcut>
                {/if}
              </ContextMenu.Item>
            {/each}
          </ContextMenu.SubContent>
        </ContextMenu.Sub>
      {/if}
    </ContextMenu.Content>
  </ContextMenu.Root>
{/if}
