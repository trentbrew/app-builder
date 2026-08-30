<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Field from '$lib/components/ui/field/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Switch } from '$lib/components/ui/switch/index.js'
  import type { EditorMarkdownPropertiesLayout } from '$lib/settings/types'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import PlusIcon from '@lucide/svelte/icons/plus'

  const RESERVED_KEYS = new Set(['title', 'description'])

  let {
    meta,
    onChange,
    defaultOpen = true,
    narrow = false,
    layout = 'sidebar',
  }: {
    meta: Record<string, unknown>
    onChange: (meta: Record<string, unknown>) => void
    defaultOpen?: boolean
    narrow?: boolean
    layout?: EditorMarkdownPropertiesLayout
  } = $props()

  let userOpen = $state<boolean | null>(null)
  const open = $derived(narrow ? false : (userOpen ?? defaultOpen))

  let newKey = $state('')
  let newValue = $state('')
  let inlineAddOpen = $state(false)

  const customEntries = $derived(Object.entries(meta).filter(([key]) => !RESERVED_KEYS.has(key)))
  const propertyCount = $derived(Object.keys(meta).length)

  function updateMeta(next: Record<string, unknown>) {
    onChange(next)
  }

  function setField(key: string, value: unknown) {
    updateMeta({ ...meta, [key]: value })
  }

  function addField() {
    const key = newKey.trim()
    const value = newValue.trim()
    if (!key) return
    updateMeta({ ...meta, [key]: value })
    newKey = ''
    newValue = ''
    inlineAddOpen = false
  }
</script>

{#snippet propertyControl(key: string, value: unknown, compact = false)}
  {#if typeof value === 'boolean'}
    <Switch checked={value} onCheckedChange={(checked) => setField(key, checked)} />
  {:else if typeof value === 'number'}
    <Input
      type="number"
      value={String(value)}
      spellcheck={false}
      class={compact ? 'h-6 w-16 border-0 bg-transparent px-1 font-mono text-xs shadow-none' : 'h-8 font-mono text-xs'}
      onchange={(event) => {
        const parsed = parseFloat(event.currentTarget.value)
        if (!Number.isNaN(parsed)) setField(key, parsed)
      }}
    />
  {:else if typeof value === 'string'}
    <Input
      {value}
      spellcheck={false}
      class={compact ? 'h-6 min-w-[5rem] border-0 bg-transparent px-1 font-mono text-xs shadow-none' : 'h-8 font-mono text-xs'}
      oninput={(event) => setField(key, event.currentTarget.value)}
    />
  {/if}
{/snippet}

{#if layout === 'inline'}
  <header
    data-component="frontmatter-inline"
    class="frontmatter-inline shrink-0 border-b border-border px-4 py-3"
  >
    {#if typeof meta.title === 'string'}
      <Input
        value={meta.title}
        spellcheck={false}
        placeholder="Title"
        class="h-auto border-0 bg-transparent px-0 py-0 text-xl font-semibold shadow-none focus-visible:ring-0"
        oninput={(event) => setField('title', event.currentTarget.value)}
      />
    {/if}

    {#if typeof meta.description === 'string'}
      <Input
        value={meta.description}
        spellcheck={false}
        placeholder="Description"
        class="mt-1 h-auto border-0 bg-transparent px-0 py-0 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
        oninput={(event) => setField('description', event.currentTarget.value)}
      />
    {/if}

  <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
    <span class="text-xs font-medium text-muted-foreground">Properties</span>

    {#each customEntries as [key, value] (key)}
      <div
        class="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5"
      >
        <span class="font-mono text-[0.625rem] lowercase text-muted-foreground">{key}</span>
        {@render propertyControl(key, value, true)}
      </div>
    {/each}

    {#if inlineAddOpen}
      <div class="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/20 p-1.5">
        <Input
          bind:value={newKey}
          spellcheck={false}
          placeholder="property"
          class="h-7 w-24 font-mono text-xs"
        />
        <Input
          bind:value={newValue}
          spellcheck={false}
          placeholder="value"
          class="h-7 w-28 font-mono text-xs"
        />
        <Button type="button" variant="secondary" size="sm" class="h-7 px-2 text-xs" onclick={addField}>
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-7 px-2 text-xs"
          onclick={() => {
            inlineAddOpen = false
            newKey = ''
            newValue = ''
          }}
        >
          Cancel
        </Button>
      </div>
    {:else}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 gap-1 px-2 text-xs text-muted-foreground"
        onclick={() => (inlineAddOpen = true)}
      >
        <PlusIcon class="size-3.5" />
        Add
      </Button>
    {/if}
  </div>
  </header>
{:else}
  <aside
    data-component="frontmatter-panel"
    data-variant="rail"
    class="frontmatter-panel flex flex-col border-l border-border bg-transparent transition-[width] duration-150 ease-out"
    class:w-72={open}
    class:w-9={!open}
  >
    <div class="flex items-center justify-between border-b border-border px-2 py-1.5">
      <button
        type="button"
        class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        title={open ? 'Collapse properties' : 'Expand properties'}
        onclick={() => (userOpen = !open)}
      >
        {#if open}
          <ChevronRightIcon class="size-3.5" />
        {:else}
          <ChevronLeftIcon class="size-3.5" />
        {/if}
        {#if open}
          <span>Properties</span>
          <span class="text-muted-foreground/70">{propertyCount}</span>
        {/if}
      </button>
    </div>

    {#if open}
      <div class="min-h-0 flex-1 overflow-auto p-2">
        <Field.Group class="gap-3">
          {#if typeof meta.title === 'string'}
            <Input
              value={meta.title}
              spellcheck={false}
              class="h-8 font-semibold"
              oninput={(event) => setField('title', event.currentTarget.value)}
            />
          {/if}

          {#if typeof meta.description === 'string'}
            <Input
              value={meta.description}
              spellcheck={false}
              class="h-8 text-muted-foreground"
              oninput={(event) => setField('description', event.currentTarget.value)}
            />
          {/if}

          {#each customEntries as [key, value] (key)}
            <Field.Field orientation="horizontal">
              <Field.Label class="font-mono text-[0.6875rem] lowercase text-muted-foreground">
                {key}
              </Field.Label>
              <Field.Content>
                {@render propertyControl(key, value, false)}
              </Field.Content>
            </Field.Field>
          {/each}

          <Field.Field class="pt-2">
            <Field.Content class="flex flex-col gap-2">
              <Input bind:value={newKey} spellcheck={false} placeholder="property" class="h-8 font-mono text-xs" />
              <Input bind:value={newValue} spellcheck={false} placeholder="value" class="h-8 font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="self-start font-mono text-[0.6875rem]"
                onclick={addField}
              >
                Add
              </Button>
            </Field.Content>
          </Field.Field>
        </Field.Group>
      </div>
    {/if}
  </aside>
{/if}
