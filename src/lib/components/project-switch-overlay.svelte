<script lang="ts">
  import NodeLoadingOverlay from '$lib/components/node-loading-overlay.svelte'
  import { projectSwitch, type SwitchPhase } from '$lib/projects/projectSwitch.svelte'

  const SWITCH_PHASE_LABEL: Record<Exclude<SwitchPhase, 'hidden'>, string> = {
    saving: 'Saving',
    restoring: 'Restoring',
    installing: 'Installing',
  }

  const statusLine = $derived(
    projectSwitch.detailPhase || (projectSwitch.phase !== 'hidden' ? SWITCH_PHASE_LABEL[projectSwitch.phase] : ''),
  )
</script>

{#if projectSwitch.phase !== 'hidden'}
  <NodeLoadingOverlay
    title={projectSwitch.message}
    message={statusLine || undefined}
    progress={projectSwitch.progress}
    progressAtTop
  />
{/if}
