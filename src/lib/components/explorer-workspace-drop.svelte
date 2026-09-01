<script lang="ts">
  import { onMount } from 'svelte'
  import { explorerDrag } from '$lib/explorerDrag.svelte'
  import { isExplorerPathDrag, readExplorerDragPath } from '$lib/explorerDrag'
  import { resolveExplorerDropTarget, type ExplorerPaneDropTarget } from '$lib/explorerDropTarget'

  let {
    dockEl = undefined,
    onFileDrop,
  }: {
    dockEl?: HTMLElement | null
    onFileDrop: (path: string, target: ExplorerPaneDropTarget) => void
  } = $props()

  let hintStyle = $state('')

  function clearHint() {
    explorerDrag.setPaneDropTarget(null)
    hintStyle = ''
  }

  function updateHint(event: DragEvent) {
    if (!isExplorerPathDrag(event.dataTransfer)) return
    const target = resolveExplorerDropTarget(event.clientX, event.clientY, dockEl)
    explorerDrag.setPaneDropTarget(target)
    positionHint(target)
  }

  function positionHint(target: ExplorerPaneDropTarget | null) {
    if (!target || !dockEl || target.side === 'center') {
      hintStyle = ''
      return
    }

    const tabGroup = dockEl.querySelector(
      `.horizon-layout-tabgroup [data-view-id="${CSS.escape(target.anchorViewId)}"]`,
    )?.closest('.horizon-layout-tabgroup')

    if (!tabGroup) {
      hintStyle = ''
      return
    }

    const rect = tabGroup.getBoundingClientRect()
    const edge = 0.22
    let top = rect.top
    let left = rect.left
    let width = rect.width
    let height = rect.height

    switch (target.side) {
      case 'left':
        width *= edge
        break
      case 'right':
        left += rect.width * (1 - edge)
        width *= edge
        break
      case 'up':
        height *= edge
        break
      case 'down':
        top += rect.height * (1 - edge)
        height *= edge
        break
    }

    hintStyle = `top:${top}px;left:${left}px;width:${width}px;height:${height}px`
  }

  $effect(() => {
    positionHint(explorerDrag.paneDropTarget)
  })

  function handleDragOver(event: DragEvent) {
    if (!explorerDrag.activePath && !isExplorerPathDrag(event.dataTransfer)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    updateHint(event)
  }

  function handleDrop(event: DragEvent) {
    if (!isExplorerPathDrag(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()

    const path = readExplorerDragPath(event.dataTransfer)
    const target =
      resolveExplorerDropTarget(event.clientX, event.clientY, dockEl) ??
      explorerDrag.paneDropTarget

    clearHint()
    explorerDrag.setActivePath(null)

    if (!path || !target) return
    onFileDrop(path, target)
  }

  onMount(() => {
    const endDrag = () => {
      explorerDrag.setActivePath(null)
      clearHint()
    }

    window.addEventListener('dragend', endDrag, true)
    window.addEventListener('drop', endDrag, true)

    return () => {
      window.removeEventListener('dragend', endDrag, true)
      window.removeEventListener('drop', endDrag, true)
    }
  })
</script>

<svelte:window ondragover={handleDragOver} ondrop={handleDrop} />

{#if hintStyle}
  <div class="explorer-pane-drop-hint" style={hintStyle} aria-hidden="true"></div>
{/if}

<style>
  .explorer-pane-drop-hint {
    position: fixed;
    z-index: 40;
    pointer-events: none;
    border: 2px solid color-mix(in oklch, var(--color-primary) 70%, transparent);
    background: color-mix(in oklch, var(--color-primary) 14%, transparent);
    border-radius: calc(var(--radius) - 2px);
  }
</style>
