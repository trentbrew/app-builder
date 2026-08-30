<script lang="ts">
  import FileIcon from '$lib/components/file-icon.svelte'
  import { getTemplate } from '$lib/projects/templates'
  import type { StoredTemplateId } from '$lib/projects/types'
  import { cn } from '$lib/utils.js'

  type Props = {
    templateId: StoredTemplateId
    class?: string
    title?: string
  }

  let { templateId, class: className, title }: Props = $props()

  const template = $derived(getTemplate(templateId))
</script>

<span class="inline-flex shrink-0" title={title ?? template.label} aria-label={template.label}>
  <FileIcon path={template.entryFile} class={cn(className ?? 'size-3.5!')} />
</span>
