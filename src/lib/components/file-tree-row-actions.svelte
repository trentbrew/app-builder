<script lang="ts">
  import EyeIcon from '@lucide/svelte/icons/eye'
  import PinIcon from '@lucide/svelte/icons/pin'
  import { fileTreeState } from '$lib/fileTreeState.svelte'

  let {
    path,
    section = 'main',
  }: {
    path: string
    section?: 'main' | 'pinned' | 'hidden'
  } = $props()

  const isPinned = $derived(fileTreeState.isPinned(path))
  const hiddenActive = $derived(fileTreeState.isHidden(path) || section === 'hidden')

  function handleHide(event: MouseEvent) {
    event.stopPropagation()
    if (hiddenActive) fileTreeState.unhide(path)
    else fileTreeState.hide(path)
  }

  function handlePin(event: MouseEvent) {
    event.stopPropagation()
    if (isPinned) fileTreeState.unpin(path)
    else fileTreeState.pin(path)
  }
</script>

<div class="file-tree-row__actions">
  <button
    type="button"
    class="file-tree-row__action-btn file-tree-row__hide-btn"
    class:file-tree-row__action-btn--active={hiddenActive}
    aria-label={hiddenActive ? 'Unhide' : 'Hide in explorer'}
    aria-pressed={hiddenActive}
    title={hiddenActive ? 'Unhide' : 'Hide in explorer'}
    onclick={handleHide}
  >
    <EyeIcon class="size-3" strokeWidth={2} />
  </button>
  <button
    type="button"
    class="file-tree-row__action-btn file-tree-row__pin-btn"
    class:file-tree-row__action-btn--active={isPinned}
    aria-label={isPinned ? 'Remove shortcut' : 'Add shortcut'}
    aria-pressed={isPinned}
    title={isPinned ? 'Remove shortcut' : 'Add shortcut'}
    onclick={handlePin}
  >
    <PinIcon class="size-3" strokeWidth={2} />
  </button>
</div>
