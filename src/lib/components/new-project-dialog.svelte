<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { TEMPLATE_LIST } from '$lib/projects/templates'
  import { dexieProjectStore } from '$lib/projects/dexieProjectStore'
  import { userTemplateStore } from '$lib/projects/userTemplateStore'
  import { getTemplate } from '$lib/projects/templates'
  import TemplateIcon from '$lib/components/template-icon.svelte'
  import type { TemplateId, UserTemplateRecord } from '$lib/projects/types'
  import { cn } from '$lib/utils.js'

  type Props = {
    open?: boolean
    userTemplateId?: string | null
    onCreated?: (projectId: string) => void
  }

  let { open = $bindable(false), userTemplateId = null, onCreated }: Props = $props()

  let name = $state('')
  let templateId = $state<TemplateId>('svelte')
  let selectedUserTemplateId = $state<string | null>(null)
  let userTemplates = $state<UserTemplateRecord[]>([])
  let creating = $state(false)

  const usingUserTemplate = $derived(Boolean(selectedUserTemplateId))
  const canCreate = $derived(Boolean(name.trim()) && !creating)

  $effect(() => {
    if (!open) return
    selectedUserTemplateId = userTemplateId
    void userTemplateStore.list().then((rows) => {
      userTemplates = rows
    })
  })

  async function handleCreate() {
    if (!canCreate) return
    creating = true
    try {
      const project = selectedUserTemplateId
        ? await dexieProjectStore.createFromUserTemplate({
            name: name.trim(),
            userTemplateId: selectedUserTemplateId,
          })
        : await dexieProjectStore.create({ name: name.trim(), templateId })
      open = false
      name = ''
      templateId = 'svelte'
      selectedUserTemplateId = null
      onCreated?.(project.id)
    } finally {
      creating = false
    }
  }

  function selectBuiltIn(id: TemplateId) {
    templateId = id
    selectedUserTemplateId = null
  }

  function selectUserTemplate(id: string) {
    selectedUserTemplateId = id
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>New project</Dialog.Title>
      <Dialog.Description>Choose a template and name your sandbox.</Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-4 py-2">
      <div class="grid gap-2">
        <label class="text-sm font-medium" for="project-name">Name</label>
        <Input id="project-name" bind:value={name} placeholder="My app" autocomplete="off" />
      </div>

      {#if userTemplates.length > 0}
        <div class="grid gap-2" role="radiogroup" aria-label="Your templates">
          <span class="text-sm font-medium">Your templates</span>
          <div class="grid gap-2 sm:grid-cols-2">
            {#each userTemplates as template (template.id)}
              <button
                type="button"
                role="radio"
                aria-checked={selectedUserTemplateId === template.id}
                class={cn(
                  'border-border bg-secondary/50 hover:bg-secondary rounded-lg border p-3 text-left transition',
                  selectedUserTemplateId === template.id && 'ring-primary ring-2',
                )}
                onclick={() => selectUserTemplate(template.id)}
              >
                <div class="flex items-center gap-2">
                  <TemplateIcon templateId={template.baseTemplateId} class="size-4!" />
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium">{template.name}</div>
                    <div class="text-muted-foreground text-xs">{getTemplate(template.baseTemplateId).label}</div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="grid gap-2" role="radiogroup" aria-label="Built-in templates">
        <span class="text-sm font-medium">Built-in starters</span>
        <div class="grid gap-2 sm:grid-cols-3">
          {#each TEMPLATE_LIST as template (template.id)}
            <button
              type="button"
              role="radio"
              aria-checked={!usingUserTemplate && templateId === template.id}
              class={cn(
                'border-border bg-secondary/50 hover:bg-secondary rounded-lg border p-3 text-left transition',
                !usingUserTemplate && templateId === template.id && 'ring-primary ring-2',
              )}
              onclick={() => selectBuiltIn(template.id)}
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
