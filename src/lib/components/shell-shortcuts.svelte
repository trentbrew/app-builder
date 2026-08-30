<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import { appChrome } from '$lib/appChrome.svelte'
  import { invokeEditorSave } from '$lib/editorSave'
  import { resolveActiveLayoutHandle } from '$lib/layoutHandle'
  import { createShortcutRoot, registerShellShortcuts } from '$lib/shortcuts'

  onMount(() => {
    if (!browser) return

    const root = createShortcutRoot()

    registerShellShortcuts(root, {
      onToggleExplorer: () => resolveActiveLayoutHandle()?.focusFilesPanel(),
      onToggleCommandPalette: () => appChrome.toggleCommandPalette(),
      onSaveActiveFile: () => invokeEditorSave(),
    })

    return () => root.destroy()
  })
</script>
