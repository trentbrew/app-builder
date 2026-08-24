<script lang="ts">
  import FilePlusIcon from '@lucide/svelte/icons/file-plus'
  import FolderPlusIcon from '@lucide/svelte/icons/folder-plus'
  import TerminalIcon from '@lucide/svelte/icons/terminal'
  import PanelLeftIcon from '@lucide/svelte/icons/panel-left'

  let {
    canCreateFile = false,
    canCreateFolder = false,
    onCreateFile,
    onCreateFolder,
    onOpenTerminal,
  }: {
    canCreateFile?: boolean
    canCreateFolder?: boolean
    onCreateFile?: () => void
    onCreateFolder?: () => void
    onOpenTerminal?: () => void
  } = $props()
</script>

<div class="empty-pane">
  <div class="empty-pane__mark" aria-hidden="true">
    <div class="empty-pane__mark-icon">△△</div>
  </div>

  <h2 class="empty-pane__title">No editor open</h2>
  <p class="empty-pane__subtitle">
    This pane is empty. Create a file to start editing, or open a terminal to run commands.
  </p>

  <div class="empty-pane__actions">
    <button type="button" class="empty-pane__action" disabled={!canCreateFile} onclick={onCreateFile}>
      <FilePlusIcon class="size-4 shrink-0" />
      <span>New File</span>
    </button>
    <button type="button" class="empty-pane__action" disabled={!canCreateFolder} onclick={onCreateFolder}>
      <FolderPlusIcon class="size-4 shrink-0" />
      <span>New Folder</span>
    </button>
    <button type="button" class="empty-pane__action" onclick={onOpenTerminal}>
      <TerminalIcon class="size-4 shrink-0" />
      <span>New Terminal</span>
    </button>
  </div>

  <p class="empty-pane__hint">
    <PanelLeftIcon class="size-3.5 shrink-0" />
    <span>Or open a file from the Explorer on the left.</span>
  </p>
</div>

<style>
  .empty-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 2rem;
    text-align: center;
    background:
      radial-gradient(
        120% 90% at 50% 0%,
        color-mix(in oklch, var(--color-primary) 6%, transparent),
        transparent 60%
      ),
      var(--color-background);
    color: var(--color-foreground);
    overflow: hidden;
  }

  .empty-pane__mark {
    display: grid;
    place-items: center;
    width: 4rem;
    height: 4rem;
    border-radius: 1.25rem;
    border: 1px solid var(--color-border);
    background: color-mix(in oklch, var(--color-primary) 10%, var(--color-background));
    color: var(--color-primary);
    box-shadow: 0 1px 2px color-mix(in oklch, var(--color-foreground) 6%, transparent);
  }

  .empty-pane__mark-icon {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    opacity: 0.85;
  }

  .empty-pane__title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .empty-pane__subtitle {
    margin: 0;
    max-width: 28rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color-muted-foreground);
  }

  .empty-pane__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .empty-pane__action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 2.25rem;
    padding: 0 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-background);
    color: var(--color-foreground);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      transform 0.05s ease;
  }

  .empty-pane__action:hover:not(:disabled) {
    background: color-mix(in oklch, var(--color-foreground) 6%, var(--color-background));
    border-color: color-mix(in oklch, var(--color-foreground) 18%, var(--color-border));
  }

  .empty-pane__action:active:not(:disabled) {
    transform: translateY(0.5px);
  }

  .empty-pane__action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .empty-pane__hint {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-muted-foreground);
    opacity: 0.8;
  }
</style>
