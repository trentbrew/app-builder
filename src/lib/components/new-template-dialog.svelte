<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { TEMPLATE_LIST } from '$lib/projects/templates'
  import { userTemplateStore } from '$lib/projects/userTemplateStore'
  import TemplateIcon from '$lib/components/template-icon.svelte'
  import type { TemplateId } from '$lib/projects/types'
  import { cn } from '$lib/utils.js'

  type Props = {
    open?: boolean
    onCreated?: (templateId: string) => void
  }

  let { open = $bindable(false), onCreated }: Props = $props()

  let name = $state('')
  let baseTemplateId = $state<TemplateId>('svelte')
  let creating = $state(false)

  const canCreate = $derived(Boolean(name.trim()) && !creating)

  async function handleCreate() {
    if (!canCreate) return
    creating = true
    try {
      const template = await userTemplateStore.createFromFramework({
        name: name.trim(),
        baseTemplateId,
      })
      open = false
      name = ''
      baseTemplateId = 'svelte'
      onCreated?.(template.id)
    } finally {
      creating = false
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>New template</Dialog.Title>
      <Dialog.Description>Start from a framework starter, then customize files in the editor.</Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-4 py-2">
      <div class="grid gap-2">
        <label class="text-sm font-medium" for="template-name">Name</label>
        <Input id="template-name" bind:value={name} placeholder="My starter" autocomplete="off" />
      </div>

      <div class="grid gap-2" role="radiogroup" aria-label="Base framework">
        <span class="text-sm font-medium">Base framework</span>
        <div class="grid gap-2 sm:grid-cols-3">
          {#each TEMPLATE_LIST as template (template.id)}
            <button
              type="button"
              role="radio"
              aria-checked={baseTemplateId === template.id}
              class={cn(
                'border-border bg-secondary/50 hover:bg-secondary rounded-lg border p-3 text-left transition',
                baseTemplateId === template.id && 'ring-primary ring-2',
              )}
              onclick={() => (baseTemplateId = template.id)}
            >
              <div class="flex items-center gap-2">
                <TemplateIcon templateId={template.id} class="size-4!" />
                <div class="text-sm font-medium">{template.label}</div>
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button disabled={!canCreate} onclick={() => void handleCreate()}>
        {creating ? 'Creating…' : 'Create'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
