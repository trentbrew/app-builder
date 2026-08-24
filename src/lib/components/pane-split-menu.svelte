<script lang="ts">
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import SplitSquareHorizontalIcon from '@lucide/svelte/icons/split-square-horizontal'
  import SplitSquareVerticalIcon from '@lucide/svelte/icons/split-square-vertical'

  let {
    disabled = false,
    onSplit,
  }: {
    disabled?: boolean
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
  } = $props()
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        class="pane-toolbar__btn"
        title="Split pane"
        aria-label="Split pane"
        disabled={disabled || !onSplit}
      >
        <SplitSquareHorizontalIcon class="size-3.5" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-44">
    <DropdownMenu.Item disabled={!onSplit} onclick={() => onSplit?.('left')}>
      <SplitSquareHorizontalIcon class="size-3.5" />
      Split left
    </DropdownMenu.Item>
    <DropdownMenu.Item disabled={!onSplit} onclick={() => onSplit?.('right')}>
      <SplitSquareHorizontalIcon class="size-3.5 rotate-180" />
      Split right
    </DropdownMenu.Item>
    <DropdownMenu.Item disabled={!onSplit} onclick={() => onSplit?.('up')}>
      <SplitSquareVerticalIcon class="size-3.5" />
      Split up
    </DropdownMenu.Item>
    <DropdownMenu.Item disabled={!onSplit} onclick={() => onSplit?.('down')}>
      <SplitSquareVerticalIcon class="size-3.5 rotate-180" />
      Split down
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
