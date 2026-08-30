<script lang="ts">
  import * as Item from '$lib/components/ui/item/index.js'
  import * as Popover from '$lib/components/ui/popover/index.js'
  import {
    clearNotifications,
    getUnreadNotificationCount,
    markAllNotificationsRead,
    notifications,
  } from '$lib/notifications.svelte'
  import BellIcon from '@lucide/svelte/icons/bell'
  import CheckCheckIcon from '@lucide/svelte/icons/check-check'
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
  import InfoIcon from '@lucide/svelte/icons/info'
  import OctagonXIcon from '@lucide/svelte/icons/octagon-x'
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'

  let open = $state(false)
  const unreadCount = $derived(getUnreadNotificationCount())

  $effect(() => {
    if (open) markAllNotificationsRead()
  })

  function formatTime(timestamp: number) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp))
  }

  function notificationIcon(type: string) {
    if (type === 'success') return CircleCheckIcon
    if (type === 'error') return OctagonXIcon
    if (type === 'warning') return TriangleAlertIcon
    if (type === 'info') return InfoIcon
    return BellIcon
  }

  function notificationIconClass(type: string) {
    if (type === 'error') return 'text-destructive'
    return 'text-foreground'
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class="status-bar__notifications-trigger"
    aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
    title="Notifications"
  >
    <BellIcon class="size-3.5" />
    {#if unreadCount > 0}
      <span class="status-bar__notifications-badge" aria-hidden="true">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    {/if}
  </Popover.Trigger>
  <Popover.Content align="end" side="top" sideOffset={8} class="status-bar__notifications-panel">
    <div class="status-bar__notifications-header">
      <p class="status-bar__notifications-title">Notifications</p>
      <div class="status-bar__notifications-actions">
        {#if notifications.items.length}
          <button
            type="button"
            class="status-bar__notifications-action"
            aria-label="Mark all as read"
            title="Mark all as read"
            onclick={markAllNotificationsRead}
          >
            <CheckCheckIcon class="size-3.5" />
          </button>
          <button
            type="button"
            class="status-bar__notifications-action"
            aria-label="Clear notifications"
            title="Clear notifications"
            onclick={clearNotifications}
          >
            <Trash2Icon class="size-3.5" />
          </button>
        {/if}
      </div>
    </div>

    {#if notifications.items.length}
      <Item.Group class="status-bar__notifications-list gap-0.5">
        {#each notifications.items as item, index (item.id)}
          <Item.Root
            size="sm"
            variant="default"
            class="status-bar__notification w-full border-transparent px-1.5 py-2 {item.read ? '' : 'bg-muted/55'}"
          >
            <Item.Media variant="icon" class={notificationIconClass(item.type)}>
              <svelte:component this={notificationIcon(item.type)} class="size-3.5" />
            </Item.Media>
            <Item.Content class="gap-0.5 min-w-0">
              <Item.Title class="text-xs leading-snug">{item.message}</Item.Title>
              <Item.Description class="text-[0.625rem]">{formatTime(item.createdAt)}</Item.Description>
            </Item.Content>
          </Item.Root>
          {#if index !== notifications.items.length - 1}
            <Item.Separator class="my-0" />
          {/if}
        {/each}
      </Item.Group>
    {:else}
      <p class="status-bar__notifications-empty">No notifications yet.</p>
    {/if}
  </Popover.Content>
</Popover.Root>

<style>
  :global(.status-bar__notifications-trigger) {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  :global(.status-bar__notifications-trigger:hover) {
    background: var(--status-bar-hover);
  }

  .status-bar__notifications-badge {
    position: absolute;
    top: 0.125rem;
    right: 0.125rem;
    min-width: 0.875rem;
    height: 0.875rem;
    padding: 0 0.125rem;
    border-radius: 9999px;
    background: var(--color-background);
    color: var(--status-bar-background);
    font-size: 0.5625rem;
    font-weight: 600;
    line-height: 0.875rem;
    text-align: center;
  }

  :global(.status-bar__notifications-panel) {
    width: 18rem;
    max-height: 18rem;
    padding: 0.5rem;
  }

  .status-bar__notifications-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.25rem 0.375rem 0.5rem;
  }

  .status-bar__notifications-title {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-bar__notifications-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .status-bar__notifications-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    background: transparent;
    color: var(--color-muted-foreground);
    cursor: pointer;
  }

  .status-bar__notifications-action:hover {
    background: var(--color-muted);
    color: var(--color-foreground);
  }

  .status-bar__notifications-list {
    overflow-y: auto;
  }

  .status-bar__notifications-empty {
    padding: 1rem 0.375rem 0.75rem;
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
    text-align: center;
  }
</style>
